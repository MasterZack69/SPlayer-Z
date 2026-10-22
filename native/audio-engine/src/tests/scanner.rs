use super::*;

#[test]
fn traversal_error_suppresses_removals_for_the_whole_root() {
    let root = Path::new("music");
    let visible = root.join("visible.mp3").to_string_lossy().into_owned();
    let hidden = root.join("restricted").join("hidden.flac");
    let outside = Path::new("other").join("removed.ogg");
    let hidden = hidden.to_string_lossy().into_owned();
    let outside = outside.to_string_lossy().into_owned();
    let existing = HashMap::from([
        (visible.as_str(), (1, 1)),
        (hidden.as_str(), (1, 1)),
        (outside.as_str(), (1, 1)),
    ]);

    let removed = collect_removed_paths(
        &existing,
        std::slice::from_ref(&visible),
        &[root.to_string_lossy().into_owned()],
    );

    assert_eq!(removed, vec![outside]);
}

#[test]
fn complete_scan_reports_missing_paths() {
    let present = Path::new("music")
        .join("present.mp3")
        .to_string_lossy()
        .into_owned();
    let missing = Path::new("music")
        .join("missing.mp3")
        .to_string_lossy()
        .into_owned();
    let existing = HashMap::from([(present.as_str(), (1, 1)), (missing.as_str(), (1, 1))]);

    let removed = collect_removed_paths(&existing, std::slice::from_ref(&present), &[]);

    assert_eq!(removed, vec![missing]);
}

#[test]
fn pending_metadata_bypasses_incremental_skip() {
    let dir = std::env::temp_dir().join(format!("splayer-year-scan-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let file = dir.join("pending.mp3");
    std::fs::write(&file, b"not an audio file").unwrap();
    let stat = std::fs::metadata(&file).unwrap();
    let mtime = stat
        .modified()
        .unwrap()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;
    let totals = std::sync::Mutex::new(Vec::new());
    for force_scan in [false, true] {
        let records = [FileRecord {
            path: file.to_string_lossy().into_owned(),
            mtime,
            size: stat.len(),
            force_scan,
        }];
        scan_directories(
            &[dir.to_string_lossy().into_owned()],
            None,
            Some(&records),
            &AtomicBool::new(false),
            &|event| {
                if let ScanEvent::Done { total, .. } = event {
                    totals.lock().unwrap().push(total);
                }
            },
        );
    }
    assert_eq!(*totals.lock().unwrap(), vec![0, 1]);
    std::fs::remove_dir_all(dir).unwrap();
}
