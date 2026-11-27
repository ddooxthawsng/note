use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use wasm_bindgen::prelude::*;

pub const MAX_TELEGRAM_PART_BYTES: u64 = 20 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TelegramPart {
    pub index: u32,
    #[serde(rename = "fileId")]
    pub file_id: String,
    #[serde(rename = "uniqueId", skip_serializing_if = "Option::is_none")]
    pub unique_id: Option<String>,
    #[serde(rename = "fileName")]
    pub file_name: String,
    pub size: u64,
    #[serde(rename = "messageId", skip_serializing_if = "Option::is_none")]
    pub message_id: Option<i64>,
    #[serde(rename = "chatId", skip_serializing_if = "Option::is_none")]
    pub chat_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TelegramManifest {
    pub version: u32,
    pub tool: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    pub size: u64,
    #[serde(rename = "partSize")]
    pub part_size: u64,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    pub parts: Vec<TelegramPart>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TelegramPartRange {
    pub index: u32,
    pub start: u64,
    pub end: u64,
}

#[wasm_bindgen]
pub fn format_bytes(bytes: f64) -> String {
    if bytes < 1024.0 {
        format!("{} B", bytes as i64)
    } else if bytes < 1024.0 * 1024.0 {
        format!("{:.1} KB", bytes / 1024.0)
    } else if bytes < 1024.0 * 1024.0 * 1024.0 {
        format!("{:.1} MB", bytes / (1024.0 * 1024.0))
    } else {
        format!("{:.2} GB", bytes / (1024.0 * 1024.0 * 1024.0))
    }
}

#[wasm_bindgen]
pub fn part_count(size: f64, part_size: Option<f64>) -> u32 {
    let ps = part_size.unwrap_or(MAX_TELEGRAM_PART_BYTES as f64);
    if size <= 0.0 || ps <= 0.0 {
        return 1;
    }
    ((size / ps).ceil() as u32).max(1)
}

pub fn plan_telegram_parts_native(size: u64, part_size: u64) -> Vec<TelegramPartRange> {
    let ps = if part_size == 0 { MAX_TELEGRAM_PART_BYTES } else { part_size };
    let count = part_count(size as f64, Some(ps as f64));
    (0..count)
        .map(|index| {
            let start = (index as u64) * ps;
            let end = size.min(start + ps);
            TelegramPartRange { index, start, end }
        })
        .collect()
}

#[wasm_bindgen]
pub fn plan_telegram_parts_json(size: f64, part_size: Option<f64>) -> String {
    let ps = part_size.unwrap_or(MAX_TELEGRAM_PART_BYTES as f64) as u64;
    let ranges = plan_telegram_parts_native(size.max(0.0) as u64, ps);
    serde_json::to_string(&ranges).unwrap_or_else(|_| "[]".to_string())
}

#[wasm_bindgen]
pub fn infer_mime_type(file_name: &str, provided: &str) -> String {
    if !provided.trim().is_empty() {
        return provided.to_string();
    }
    let ext = file_name
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "avif" => "image/avif",
        "bmp" => "image/bmp",
        "gif" => "image/gif",
        "jpeg" | "jpg" => "image/jpeg",
        "png" => "image/png",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    }
    .to_string()
}

pub fn parse_manifest_native(raw: &str) -> Result<TelegramManifest, String> {
    let manifest: TelegramManifest =
        serde_json::from_str(raw).map_err(|_| "Invalid Telegram manifest.".to_string())?;

    if manifest.version != 1
        || manifest.tool != "telegram-drive"
        || manifest.size == 0
        || manifest.part_size == 0
        || manifest.part_size > MAX_TELEGRAM_PART_BYTES
        || manifest.parts.is_empty()
    {
        return Err("Invalid Telegram manifest.".to_string());
    }

    let mut total_size: u64 = 0;
    for (idx, part) in manifest.parts.iter().enumerate() {
        if part.index != idx as u32
            || part.file_id.is_empty()
            || part.size == 0
            || part.size > manifest.part_size
        {
            return Err("Invalid Telegram manifest.".to_string());
        }
        total_size = total_size
            .checked_add(part.size)
            .ok_or_else(|| "Invalid Telegram manifest.".to_string())?;
    }

    if total_size != manifest.size {
        return Err("Invalid Telegram manifest.".to_string());
    }

    Ok(manifest)
}

#[wasm_bindgen]
pub fn validate_manifest_json(raw: &str) -> Result<String, JsValue> {
    let manifest = parse_manifest_native(raw).map_err(|e| JsValue::from_str(&e))?;
    serde_json::to_string(&manifest).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn count_words(html: &str) -> u32 {
    let mut plain = String::with_capacity(html.len());
    let mut in_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => {
                in_tag = true;
                plain.push(' ');
            }
            '>' => {
                in_tag = false;
            }
            _ if !in_tag => plain.push(ch),
            _ => {}
        }
    }
    let cleaned = plain.replace("&nbsp;", " ");
    cleaned.split_whitespace().count() as u32
}

#[wasm_bindgen]
pub fn password_strength(pw: &str) -> u32 {
    let mut score = 0u32;
    let len = pw.chars().count();
    if len >= 6 {
        score += 1;
    }
    if len >= 10 {
        score += 1;
    }
    let has_upper = pw.chars().any(|c| c.is_ascii_uppercase());
    let has_lower = pw.chars().any(|c| c.is_ascii_lowercase());
    if has_upper && has_lower {
        score += 1;
    }
    let has_digit = pw.chars().any(|c| c.is_ascii_digit());
    let has_symbol = pw.chars().any(|c| !c.is_ascii_alphanumeric());
    if has_digit && has_symbol {
        score += 1;
    }
    score
}

#[wasm_bindgen]
pub fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let result = hasher.finalize();
    result.iter().map(|b| format!("{:02x}", b)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parity_format_bytes() {
        assert_eq!(format_bytes(512.0), "512 B");
        assert_eq!(format_bytes(1536.0), "1.5 KB");
        assert_eq!(format_bytes(2.5 * 1024.0 * 1024.0), "2.5 MB");
        assert_eq!(format_bytes(2.0 * 1024.0 * 1024.0 * 1024.0), "2.00 GB");
    }

    #[test]
    fn parity_part_planning() {
        assert_eq!(part_count(0.0, None), 1);
        assert_eq!(part_count(MAX_TELEGRAM_PART_BYTES as f64, None), 1);
        assert_eq!(part_count((MAX_TELEGRAM_PART_BYTES + 1) as f64, None), 2);
        let parts = plan_telegram_parts_native(MAX_TELEGRAM_PART_BYTES + 100, MAX_TELEGRAM_PART_BYTES);
        assert_eq!(parts.len(), 2);
        assert_eq!(parts[0], TelegramPartRange { index: 0, start: 0, end: MAX_TELEGRAM_PART_BYTES });
        assert_eq!(parts[1], TelegramPartRange { index: 1, start: MAX_TELEGRAM_PART_BYTES, end: MAX_TELEGRAM_PART_BYTES + 100 });
    }

    #[test]
    fn parity_count_words() {
        assert_eq!(count_words(""), 0);
        assert_eq!(count_words("<p>Hello&nbsp;world</p><div>from Rust</div>"), 4);
    }

    #[test]
    fn parity_password_strength() {
        assert_eq!(password_strength("abc"), 0);
        assert_eq!(password_strength("abcdef"), 1);
        assert_eq!(password_strength("Abcdef"), 2);
        assert_eq!(password_strength("Abcdefghij"), 3);
        assert_eq!(password_strength("Abcdefgh1!"), 4);
    }

    #[test]
    fn parity_sha256_hex() {
        assert_eq!(
            sha256_hex("hello"),
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }

    #[test]
    fn parity_manifest_validation() {
        let valid = r#"{"version":1,"tool":"telegram-drive","fileName":"a.png","mimeType":"image/png","size":100,"partSize":20971520,"createdAt":"2026-01-01T00:00:00Z","parts":[{"index":0,"fileId":"abc","fileName":"a.png","size":100}]}"#;
        assert!(parse_manifest_native(valid).is_ok());

        let bad_size = r#"{"version":1,"tool":"telegram-drive","fileName":"a.png","mimeType":"image/png","size":101,"partSize":20971520,"createdAt":"2026-01-01T00:00:00Z","parts":[{"index":0,"fileId":"abc","fileName":"a.png","size":100}]}"#;
        assert!(parse_manifest_native(bad_size).is_err());
    }
}
