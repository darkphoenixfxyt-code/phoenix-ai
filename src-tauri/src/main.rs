#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream, UdpSocket};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex, OnceLock,
};
use tauri::command;

static MESSENGER_MESSAGES: OnceLock<Mutex<Vec<String>>> = OnceLock::new();
static MESSENGER_PEER: OnceLock<Mutex<Option<String>>> = OnceLock::new();
static MESSENGER_RUNNING: AtomicBool = AtomicBool::new(false);

fn messenger_messages() -> &'static Mutex<Vec<String>> {
    MESSENGER_MESSAGES.get_or_init(|| Mutex::new(Vec::new()))
}

fn messenger_peer() -> &'static Mutex<Option<String>> {
    MESSENGER_PEER.get_or_init(|| Mutex::new(None))
}

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    images: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct OllamaResponse {
    response: String,
}

#[command]
async fn run_local_ai(
    model: String,
    prompt: String,
    image: Option<String>,
) -> Result<String, String> {
    let ollama_model = match model.as_str() {
        "Phi3Mini" => "phi3",
        "Qwen2_7B" => "qwen2.5:7b-instruct",
        "VisionAI" => "qwen2.5vl:7b",
        _ => "phi3",
    };

    let clean_image = image.map(|img| {
        img.replace("data:image/png;base64,", "")
            .replace("data:image/jpeg;base64,", "")
            .replace("data:image/jpg;base64,", "")
            .replace("data:image/webp;base64,", "")
    });

    let body = OllamaRequest {
        model: ollama_model.to_string(),
        prompt,
        images: clean_image.map(|img| vec![img]),
    };

    let client = reqwest::Client::new();

    let res = client
        .post("http://localhost:11434/api/generate")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request error: {}", e))?;

    let text = res
        .text()
        .await
        .map_err(|e| format!("Ollama read error: {}", e))?;

    let mut final_text = String::new();

    for line in text.lines() {
        let trimmed = line.trim();

        if trimmed.is_empty() {
            continue;
        }

        if let Ok(parsed) = serde_json::from_str::<OllamaResponse>(trimmed) {
            final_text.push_str(&parsed.response);
        }
    }

    Ok(final_text)
}

#[command]
async fn generate_image_sdxl(prompt: String) -> Result<String, String> {
    let client = reqwest::Client::new();

    let workflow = json!({
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": 123456789,
                "steps": 8,
                "cfg": 7.0,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1.0,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0]
            }
        },
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {
                "ckpt_name": "sd_xl_base_1.0.safetensors"
            }
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {
                "width": 512,
                "height": 512,
                "batch_size": 1
            }
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": prompt,
                "clip": ["4", 1]
            }
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "blurry, low quality, distorted, ugly, bad anatomy, watermark",
                "clip": ["4", 1]
            }
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["3", 0],
                "vae": ["4", 2]
            }
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {
                "filename_prefix": "phoenix_ai",
                "images": ["8", 0]
            }
        }
    });

    let body = json!({
        "prompt": workflow
    });

    let res = client
        .post("http://127.0.0.1:8188/prompt")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("ComfyUI request error: {}", e))?;

    let value: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("ComfyUI response error: {}", e))?;

    let prompt_id = value["prompt_id"]
        .as_str()
        .ok_or("No prompt_id returned from ComfyUI")?;

    for _ in 0..300 {
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;

        let history_url = format!("http://127.0.0.1:8188/history/{}", prompt_id);

        let history: serde_json::Value = client
            .get(&history_url)
            .send()
            .await
            .map_err(|e| format!("ComfyUI history error: {}", e))?
            .json()
            .await
            .map_err(|e| format!("ComfyUI history parse error: {}", e))?;

        if let Some(images) = history[prompt_id]["outputs"]["9"]["images"].as_array() {
            if let Some(first_image) = images.first() {
                let filename = first_image["filename"].as_str().unwrap_or("");
                let subfolder = first_image["subfolder"].as_str().unwrap_or("");
                let image_type = first_image["type"].as_str().unwrap_or("output");

                let image_url = format!(
                    "http://127.0.0.1:8188/view?filename={}&subfolder={}&type={}",
                    filename, subfolder, image_type
                );

                let bytes = client
                    .get(&image_url)
                    .send()
                    .await
                    .map_err(|e| format!("Image download error: {}", e))?
                    .bytes()
                    .await
                    .map_err(|e| format!("Image bytes error: {}", e))?;

                let base64_image = general_purpose::STANDARD.encode(bytes);

                let data_url = format!("data:image/png;base64,{}", base64_image);

                return Ok(data_url);
            }
        }
    }

    Err("Image generation timed out.".to_string())
}

/* PHOENIX MESSENGER */

#[command]
fn get_local_ip() -> Result<String, String> {
    let socket = UdpSocket::bind("0.0.0.0:0")
        .map_err(|e| format!("IP bind error: {}", e))?;

    socket
        .connect("8.8.8.8:80")
        .map_err(|e| format!("IP detect error: {}", e))?;

    let local_addr = socket
        .local_addr()
        .map_err(|e| format!("Local address error: {}", e))?;

    Ok(format!("{}:7878", local_addr.ip()))
}

#[command]
fn start_messenger_server() -> Result<String, String> {
    if MESSENGER_RUNNING.load(Ordering::SeqCst) {
        return Ok("Messenger server already running on port 7878.".to_string());
    }

    MESSENGER_RUNNING.store(true, Ordering::SeqCst);

    std::thread::spawn(|| {
        let listener = match TcpListener::bind("0.0.0.0:7878") {
            Ok(listener) => listener,
            Err(e) => {
                if let Ok(mut messages) = messenger_messages().lock() {
                    messages.push(format!("SYSTEM: Server error: {}", e));
                }

                MESSENGER_RUNNING.store(false, Ordering::SeqCst);
                return;
            }
        };

        if let Ok(mut messages) = messenger_messages().lock() {
            messages.push("SYSTEM: Messenger server started on port 7878.".to_string());
        }

        for stream in listener.incoming() {
            match stream {
                Ok(mut stream) => {
                    let mut buffer = [0; 4096];

                    match stream.read(&mut buffer) {
                        Ok(size) if size > 0 => {
                            let msg = String::from_utf8_lossy(&buffer[..size]).to_string();

                            if let Ok(mut messages) = messenger_messages().lock() {
                                messages.push(format!("FRIEND: {}", msg));
                            }
                        }

                        Ok(_) => {}

                        Err(e) => {
                            if let Ok(mut messages) = messenger_messages().lock() {
                                messages.push(format!("SYSTEM: Read error: {}", e));
                            }
                        }
                    }
                }

                Err(e) => {
                    if let Ok(mut messages) = messenger_messages().lock() {
                        messages.push(format!("SYSTEM: Connection error: {}", e));
                    }
                }
            }
        }
    });

    Ok("Messenger server started on port 7878.".to_string())
}

#[command]
fn set_messenger_peer(peer: String) -> Result<String, String> {
    let cleaned = peer.trim().to_string();

    if cleaned.is_empty() {
        return Err("Peer address cannot be empty.".to_string());
    }

    let final_peer = if cleaned.contains(":") {
        cleaned
    } else {
        format!("{}:7878", cleaned)
    };

    if let Ok(mut peer_lock) = messenger_peer().lock() {
        *peer_lock = Some(final_peer.clone());
    }

    Ok(format!("Peer set to {}", final_peer))
}

#[command]
fn send_messenger_message(message: String) -> Result<String, String> {
    let peer = {
        let peer_lock = messenger_peer()
            .lock()
            .map_err(|_| "Could not lock peer.".to_string())?;

        peer_lock.clone()
    };

    let peer = peer.ok_or("No peer set. Join a room first.".to_string())?;

    let mut stream = TcpStream::connect(&peer)
        .map_err(|e| format!("Could not connect to {}: {}", peer, e))?;

    stream
        .write_all(message.as_bytes())
        .map_err(|e| format!("Could not send message: {}", e))?;

    if let Ok(mut messages) = messenger_messages().lock() {
        messages.push(format!("ME: {}", message));
    }

    Ok("Message sent.".to_string())
}

#[command]
fn get_messenger_messages() -> Result<Vec<String>, String> {
    let mut messages = messenger_messages()
        .lock()
        .map_err(|_| "Could not read messages.".to_string())?;

    let copy = messages.clone();

    messages.clear();

    Ok(copy)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            run_local_ai,
            generate_image_sdxl,
            get_local_ip,
            start_messenger_server,
            set_messenger_peer,
            send_messenger_message,
            get_messenger_messages
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}