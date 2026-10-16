use super::*;
use std::sync::atomic::{AtomicU64, Ordering};

static TEST_FILE_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Return a process-unique path for an isolated cover test.
///
/// @param name - Readable suffix identifying the test output.
fn test_output_path(name: &str) -> std::path::PathBuf {
    let sequence = TEST_FILE_COUNTER.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!(
        "splayer-metadata-{}-{sequence}-{name}",
        std::process::id()
    ))
}

#[test]
fn invalid_cover_does_not_create_fake_jpeg() {
    let output = test_output_path("invalid.jpg");
    let _ = std::fs::remove_file(&output);

    assert!(generate_cover_thumbnail(b"not an image", &output).is_err());
    assert!(!output.exists());
}

#[test]
fn png_cover_is_encoded_as_jpeg() {
    let output = test_output_path("converted.jpg");
    let mut png = Cursor::new(Vec::new());
    image::DynamicImage::new_rgb8(2, 2)
        .write_to(&mut png, image::ImageFormat::Png)
        .unwrap();

    generate_cover_thumbnail(png.get_ref(), &output).unwrap();

    let cached = std::fs::read(&output).unwrap();
    assert!(cached.starts_with(&[0xff, 0xd8, 0xff]));
    let _ = std::fs::remove_file(output);
}

/// Build an in-memory PNG for cover assertions.
///
/// @param width - Image width in pixels.
/// @param height - Image height in pixels.
/// @param color - Uniform RGB pixel value.
fn png_cover(width: u32, height: u32, color: [u8; 3]) -> Vec<u8> {
    let image = image::RgbImage::from_pixel(width, height, image::Rgb(color));
    let mut output = Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(image)
        .write_to(&mut output, image::ImageFormat::Png)
        .unwrap();
    output.into_inner()
}

/// Encode a FLAC PICTURE block payload with independently controlled MIME bytes.
///
/// @param picture_type - FLAC picture role, such as 3 for a front cover.
/// @param mime - Raw MIME label, including malformed values for regressions.
/// @param image - Embedded image payload.
fn picture_block(picture_type: u32, mime: &[u8], image: &[u8]) -> Vec<u8> {
    let mut payload = picture_type.to_be_bytes().to_vec();
    payload.extend_from_slice(&(mime.len() as u32).to_be_bytes());
    payload.extend_from_slice(mime);
    payload.extend_from_slice(&0_u32.to_be_bytes()); // Empty description.
    for value in [600_u32, 400, 24, 0, image.len() as u32] {
        payload.extend_from_slice(&value.to_be_bytes());
    }
    payload.extend_from_slice(image);
    payload
}

/// Assemble 30ms of valid silent FLAC audio with optional PICTURE metadata blocks.
///
/// @param pictures - Encoded PICTURE payloads in metadata order.
fn flac_with_pictures(pictures: &[Vec<u8>]) -> Vec<u8> {
    // Generated from silence; no copyrighted audio or external fixtures are required.
    let stream_info = [
        0x12, 0x00, 0x12, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x10, 0x0a, 0xc4, 0x42, 0xf0, 0x00,
        0x00, 0x05, 0x2b, 0x3f, 0x00, 0x39, 0xb8, 0xe0, 0x27, 0xa5, 0x6b, 0x9f, 0x5e, 0x00, 0x6d,
        0xd0, 0x45, 0x23, 0xf3,
    ];
    let frame = [
        0xff, 0xf8, 0x79, 0x18, 0x00, 0x05, 0x2a, 0x91, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xa6,
        0x69,
    ];
    let mut flac = b"fLaC".to_vec();
    flac.extend_from_slice(&[if pictures.is_empty() { 0x80 } else { 0 }, 0, 0, 34]);
    flac.extend_from_slice(&stream_info);
    for (index, picture) in pictures.iter().enumerate() {
        let last = index + 1 == pictures.len();
        flac.push(if last { 0x86 } else { 6 });
        flac.extend_from_slice(&(picture.len() as u32).to_be_bytes()[1..]);
        flac.extend_from_slice(picture);
    }
    flac.extend_from_slice(&frame);
    flac
}

struct CoverFixture {
    directory: std::path::PathBuf,
    source: String,
    cache: String,
}

impl CoverFixture {
    /// Write isolated audio and cache paths, cleaned up when the fixture is dropped.
    ///
    /// @param bytes - Complete synthetic audio file contents.
    fn new(bytes: &[u8]) -> Self {
        let directory = test_output_path("cover-fixture");
        std::fs::create_dir_all(&directory).unwrap();
        let path = directory.join("track.flac");
        std::fs::write(&path, bytes).unwrap();
        Self {
            source: path.to_string_lossy().into_owned(),
            cache: directory.join("cache").to_string_lossy().into_owned(),
            directory,
        }
    }

    /// Open this fixture through the same FFmpeg reader used by the application.
    fn reader(&self) -> AudioReader {
        AudioReader::new(File::open(&self.source).unwrap()).unwrap()
    }
}

impl Drop for CoverFixture {
    /// Remove this test's source and thumbnail cache without affecting other tests.
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.directory);
    }
}

#[test]
fn flac_fallback_recovers_missing_and_nonstandard_mime_labels() {
    let png = png_cover(2, 2, [220, 30, 40]);
    for mime in [
        b"".as_slice(),
        &[b'x'; 80],
        &[0xff, 0xfe],
        b"application/octet-stream",
        b"image/unknown",
        b"image/png\0unexpected",
    ] {
        let bytes = flac_with_pictures(&[picture_block(3, mime, &png)]);
        let fixture = CoverFixture::new(&bytes);
        let reader = fixture.reader();
        if mime.is_empty() || mime.len() >= 64 {
            assert!(
                reader.cover().is_none(),
                "fixture must reproduce FFmpeg's rejection"
            );
        }
        assert_eq!(read_flac_picture(&fixture.source), Some(png.clone()));
        assert_eq!(
            read_attached_pic(&reader, &fixture.source),
            Some(png.clone())
        );
        assert_eq!(std::fs::read(&fixture.source).unwrap(), bytes);
    }
}

#[test]
fn recovered_picture_reaches_scanner_and_playback_metadata() {
    let png = png_cover(600, 400, [220, 30, 40]);
    let bytes = flac_with_pictures(&[picture_block(3, b"", &png)]);
    let fixture = CoverFixture::new(&bytes);
    let scanned = crate::scanner::probe_fast(&fixture.source, Some(&fixture.cache)).unwrap();
    let thumbnail_path = scanned.cover.unwrap();
    let thumbnail = image::open(&thumbnail_path).unwrap();
    assert_eq!((thumbnail.width(), thumbnail.height()), (300, 200));
    assert!(std::fs::read(&thumbnail_path)
        .unwrap()
        .starts_with(&[0xff, 0xd8, 0xff]));

    let prepared = crate::decoder::prepare_decode(
        &fixture.source,
        Some(&fixture.cache),
        ffmpeg_audio::HttpCancelHandle::new(),
    )
    .unwrap();
    let shared = crate::decoder::buffer::Shared::new(44_100, 2);
    let (metadata, worker, _) = crate::decoder::start_prepared_decode(
        prepared,
        std::sync::Arc::clone(&shared),
        std::sync::Arc::new(parking_lot::Mutex::new(
            crate::dsp::equalizer::Equalizer::new(44_100, 2),
        )),
        std::sync::Arc::new(parking_lot::Mutex::new(
            crate::dsp::tempo::StretchProcessor::new(2, 44_100),
        )),
    )
    .unwrap();
    worker.join().unwrap();
    assert_eq!(metadata.cover, Some(thumbnail_path));
    assert_eq!(metadata.cover_raw, Some(png));
    assert!(matches!(
        shared.try_pop(),
        crate::decoder::buffer::PopResult::Chunk(_)
    ));
    assert_eq!(std::fs::read(&fixture.source).unwrap(), bytes);
}

#[test]
fn ffmpeg_picture_keeps_precedence_over_the_fallback() {
    let back = png_cover(2, 2, [30, 40, 220]);
    let front = png_cover(2, 2, [220, 30, 40]);
    let fixture = CoverFixture::new(&flac_with_pictures(&[
        picture_block(4, b"image/png", &back),
        picture_block(3, b"", &front),
    ]));
    let reader = fixture.reader();
    assert_eq!(reader.cover().unwrap().data, back);
    assert_eq!(read_attached_pic(&reader, &fixture.source), Some(back));
    assert_eq!(read_flac_picture(&fixture.source), Some(front));
}

#[test]
fn flac_fallback_uses_first_picture_when_there_is_no_front_cover() {
    let first = png_cover(2, 2, [30, 40, 220]);
    let second = png_cover(2, 2, [220, 30, 40]);
    let fixture = CoverFixture::new(&flac_with_pictures(&[
        picture_block(4, b"", &first),
        picture_block(0, b"", &second),
    ]));
    assert_eq!(read_flac_picture(&fixture.source), Some(first));
}

#[test]
fn flac_fallback_skips_invalid_pictures_before_a_valid_one() {
    let png = png_cover(2, 2, [220, 30, 40]);
    let mut bad_length = picture_block(3, b"", &png);
    bad_length[28..32].copy_from_slice(&u32::MAX.to_be_bytes());
    let fixture = CoverFixture::new(&flac_with_pictures(&[
        bad_length,
        picture_block(3, b"-->", b"https://example.invalid/cover.png"),
        picture_block(3, b"", &png),
    ]));
    assert_eq!(read_flac_picture(&fixture.source), Some(png));
}

#[test]
fn flac_fallback_rejects_out_of_block_lengths_without_allocating_them() {
    let png = png_cover(2, 2, [220, 30, 40]);
    // MIME, description and picture data length are all untrusted 32-bit fields.
    for offset in [4, 8, 28] {
        let mut picture = picture_block(3, b"", &png);
        picture[offset..offset + 4].copy_from_slice(&u32::MAX.to_be_bytes());
        let fixture = CoverFixture::new(&flac_with_pictures(&[picture]));
        assert!(read_flac_picture(&fixture.source).is_none());
    }
}

#[test]
fn flac_fallback_rejects_every_truncated_picture_prefix() {
    let png = png_cover(2, 2, [220, 30, 40]);
    let bytes = flac_with_pictures(&[picture_block(3, b"", &png)]);
    // The last 16 bytes are the audio frame, not metadata.
    let metadata_end = bytes.len() - 16;
    let fixture = CoverFixture::new(&[]);
    for length in 0..metadata_end {
        std::fs::write(&fixture.source, &bytes[..length]).unwrap();
        assert!(
            read_flac_picture(&fixture.source).is_none(),
            "prefix length {length}"
        );
    }
}

#[test]
fn no_art_and_non_flac_sources_keep_the_existing_behavior() {
    let fixture = CoverFixture::new(&flac_with_pictures(&[]));
    let reader = fixture.reader();
    assert!(read_attached_pic(&reader, &fixture.source).is_none());
    assert!(extract_cover_thumbnail(&reader, &fixture.source, &fixture.cache).is_none());
    assert!(!Path::new(&fixture.cache).exists());
    assert!(read_flac_picture("https://example.invalid/track.flac").is_none());
    std::fs::write(&fixture.source, b"RIFFnot a FLAC file").unwrap();
    assert!(read_flac_picture(&fixture.source).is_none());
}

#[test]
fn folder_art_remains_available_when_no_embedded_picture_exists() {
    let fixture = CoverFixture::new(&flac_with_pictures(&[]));
    std::fs::write(
        fixture.directory.join("cover.png"),
        png_cover(600, 400, [20, 50, 80]),
    )
    .unwrap();
    let reader = fixture.reader();
    let thumbnail = extract_cover_thumbnail(&reader, &fixture.source, &fixture.cache).unwrap();
    assert_eq!(image::open(thumbnail).unwrap().width(), 300);
    assert!(read_attached_pic(&reader, &fixture.source).is_none());
}

#[test]
fn flac_fallback_recovers_jpeg_with_a_description_and_wrong_mime() {
    let png = png_cover(2, 2, [220, 30, 40]);
    let jpeg = make_thumbnail_jpeg(&png, 2).unwrap();
    let mut picture = picture_block(3, b"broken", &jpeg);
    let description = "Album artwork — front".as_bytes();
    picture[14..18].copy_from_slice(&(description.len() as u32).to_be_bytes());
    picture.splice(18..18, description.iter().copied());
    let fixture = CoverFixture::new(&flac_with_pictures(&[picture]));
    assert_eq!(read_flac_picture(&fixture.source), Some(jpeg.clone()));
    assert_eq!(
        read_attached_pic(&fixture.reader(), &fixture.source),
        Some(jpeg)
    );
}

#[test]
fn flac_fallback_does_not_read_the_audio_payload() {
    let png = png_cover(2, 2, [220, 30, 40]);
    let fixture = CoverFixture::new(&flac_with_pictures(&[picture_block(3, b"", &png)]));
    let file = std::fs::OpenOptions::new()
        .write(true)
        .open(&fixture.source)
        .unwrap();
    // A sparse 2 GiB payload must not become a 2 GiB allocation or read.
    file.set_len(2 * 1024 * 1024 * 1024).unwrap();
    assert_eq!(read_flac_picture(&fixture.source), Some(png));
}
