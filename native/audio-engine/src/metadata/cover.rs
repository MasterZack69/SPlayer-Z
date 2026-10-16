use std::collections::hash_map::DefaultHasher;
use std::fs::File;
use std::hash::{Hash, Hasher};
use std::io::{Cursor, Read, Seek, SeekFrom};
use std::path::Path;

use ffmpeg_audio::AudioReader;

use super::folder_cover::find_folder_cover;

/// 缩略图最大边长（px）
const THUMB_SIZE: u32 = 300;

/// 计算源文件对应的封面缩略图缓存路径（按源路径哈希命名）
pub fn cover_thumb_path(source: &str, cache_dir: &str) -> std::path::PathBuf {
    let mut hasher = DefaultHasher::new();
    source.hash(&mut hasher);
    let hash = hasher.finish();
    Path::new(cache_dir).join(format!("cover_{hash:016x}_thumb.jpg"))
}

/// Cache a 300px embedded cover, falling back to an image beside the audio file.
///
/// @param reader - Open audio reader supplying FFmpeg's preferred picture.
/// @param source - Local path or streaming URL of the audio source.
/// @param cache_dir - Destination directory for JPEG thumbnails.
pub fn extract_cover_thumbnail(
    reader: &AudioReader,
    source: &str,
    cache_dir: &str,
) -> Option<String> {
    let thumb_file = cover_thumb_path(source, cache_dir);

    if thumb_file.exists() {
        return Some(thumb_file.to_string_lossy().into_owned());
    }

    let data = read_attached_pic(reader, source)
        .or_else(|| find_folder_cover(source).and_then(|p| std::fs::read(p).ok()))?;
    std::fs::create_dir_all(cache_dir).ok()?;
    generate_cover_thumbnail(&data, &thumb_file).ok()?;

    Some(thumb_file.to_string_lossy().into_owned())
}

/// Read original embedded artwork without caching or rewriting the source.
///
/// @param reader - Open audio reader; its selected picture takes precedence.
/// @param source - Local audio path used if FFmpeg discarded a FLAC picture.
pub fn read_attached_pic(reader: &AudioReader, source: &str) -> Option<Vec<u8>> {
    reader
        .cover()
        .map(|cover| cover.data)
        .or_else(|| read_flac_picture(source))
}

/// Recover a local FLAC picture whose MIME label FFmpeg could not accept.
///
/// @param source - Local path; URLs and other containers are not fetched or parsed.
/// @returns Front-cover bytes, or the first recognizable embedded picture.
fn read_flac_picture(source: &str) -> Option<Vec<u8>> {
    let mut file = File::open(source).ok()?;
    let file_len = file.metadata().ok()?.len();
    let mut marker = [0; 4];
    file.read_exact(&mut marker).ok()?;
    if &marker != b"fLaC" {
        return None;
    }

    let mut selected = None;
    loop {
        let mut header = [0; 4];
        file.read_exact(&mut header).ok()?;
        let block_len = u32::from_be_bytes([0, header[1], header[2], header[3]]);
        let block_start = file.stream_position().ok()?;
        let block_end = block_start.checked_add(u64::from(block_len))?;
        if block_end > file_len {
            break;
        }

        if header[0] & 0x7f == 6 && block_len >= 32 {
            // Check every range against this metadata block, not the audio file.
            let mut fields = [0; 8];
            file.read_exact(&mut fields).ok()?;
            let picture_type = u32::from_be_bytes(fields[..4].try_into().ok()?);
            let mime_len = u32::from_be_bytes(fields[4..].try_into().ok()?);
            let description_offset = block_start + 8 + u64::from(mime_len);
            if description_offset + 4 <= block_end {
                file.seek(SeekFrom::Start(description_offset)).ok()?;
                let mut length = [0; 4];
                file.read_exact(&mut length).ok()?;
                let description_len = u32::from_be_bytes(length);
                let dimensions_offset = description_offset + 4 + u64::from(description_len);
                if dimensions_offset + 20 <= block_end {
                    file.seek(SeekFrom::Start(dimensions_offset + 16)).ok()?;
                    file.read_exact(&mut length).ok()?;
                    let data_len = u32::from_be_bytes(length);
                    let data_offset = dimensions_offset + 20;
                    if data_len > 0 && data_offset + u64::from(data_len) <= block_end {
                        // Sniff bytes instead of trusting a missing or malformed MIME label.
                        let mut signature = [0; 32];
                        let signature_len = (data_len as usize).min(signature.len());
                        file.read_exact(&mut signature[..signature_len]).ok()?;
                        if image::guess_format(&signature[..signature_len]).is_ok() {
                            if selected.is_none() || picture_type == 3 {
                                selected = Some((data_offset, data_len));
                            }
                            if picture_type == 3 {
                                break;
                            }
                        }
                    }
                }
            }
        }

        if header[0] & 0x80 != 0 {
            break;
        }
        file.seek(SeekFrom::Start(block_end)).ok()?;
    }

    let (offset, length) = selected?;
    file.seek(SeekFrom::Start(offset)).ok()?;
    // FLAC's 24-bit block length bounds this allocation to less than 16 MiB.
    let mut data = vec![0; length as usize];
    file.read_exact(&mut data).ok()?;
    Some(data)
}

/// 将任意图片字节缩放为 JPEG 缩略图字节（内存内，不落盘）。
/// 用于选图预览：原生层缩好再交给渲染层，避免渲染层把整图解码成位图占内存
pub fn make_thumbnail_jpeg(data: &[u8], max_size: u32) -> anyhow::Result<Vec<u8>> {
    let image = image::load_from_memory(data)?;
    let thumbnail = image.thumbnail(max_size, max_size);
    let mut output = Vec::new();
    thumbnail.write_to(&mut Cursor::new(&mut output), image::ImageFormat::Jpeg)?;
    Ok(output)
}

/// 将原始图片数据缩放为 JPEG 缩略图
fn generate_cover_thumbnail(
    data: &[u8],
    output_path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let image = image::load_from_memory(data)?;
    let thumbnail = image.thumbnail(THUMB_SIZE, THUMB_SIZE);
    thumbnail.save_with_format(output_path, image::ImageFormat::Jpeg)?;
    Ok(())
}

#[cfg(test)]
#[path = "tests/cover.rs"]
mod tests;
