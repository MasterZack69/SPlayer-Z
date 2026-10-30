use super::*;

#[test]
fn common_tags_are_matched_case_insensitively() {
    let dict = HashMap::from([
        ("TITLE".to_string(), "Track".to_string()),
        ("Album_Artist".to_string(), "Artist".to_string()),
        ("TRACK".to_string(), "7".to_string()),
        ("Genre".to_string(), "Pop Rock".to_string()),
    ]);

    let tags = extract_tags(&dict);
    assert_eq!(tags.title.as_deref(), Some("Track"));
    assert_eq!(tags.artist.as_deref(), Some("Artist"));
    assert_eq!(tags.track, Some(7));
    assert_eq!(tags.genre.as_deref(), Some("Pop Rock"));
}

#[test]
fn r128_track_gain_has_priority_and_uses_fixed_point_units() {
    let dict = HashMap::from([
        ("R128_TRACK_GAIN".to_string(), "-1536".to_string()),
        ("replaygain_track_gain".to_string(), "-3.00 dB".to_string()),
    ]);

    assert_eq!(extract_replay_gain(&dict), Some(-6.0));
}

#[test]
fn decibels_are_converted_to_linear_gain() {
    assert!((db_to_linear(-6.0) - 0.501_187_2).abs() < 0.000_001);
}

#[test]
fn year_falls_through_invalid_candidates_without_using_original_dates() {
    let dict = HashMap::from([
        ("DATE".into(), "unknown".into()),
        ("WM/Year".into(), " 2001/02/03 ".into()),
        ("ORIGINALDATE".into(), "1999".into()),
    ]);
    assert_eq!(extract_tags(&dict).year, Some(2001));
    assert_eq!(
        extract_tags(&HashMap::from([("ORIGINALDATE".into(), "1999".into())])).year,
        None
    );
}

#[test]
fn disc_and_track_numbers_accept_totals_and_common_aliases() {
    for key in ["disc", "DISCNUMBER", "disk", "TPOS", "WM/PartOfSet"] {
        let tags = extract_tags(&HashMap::from([
            (key.into(), " 02/03 ".into()),
            ("TRACK".into(), "07/12".into()),
            ("DISCSUBTITLE".into(), " Bonus Disc ".into()),
        ]));
        assert_eq!(tags.disc, Some(2));
        assert_eq!(tags.track, Some(7));
        assert_eq!(tags.disc_title.as_deref(), Some("Bonus Disc"));
    }
}

#[test]
fn invalid_disc_numbers_are_unknown() {
    for value in ["", "0", "-1", "Disc 2", "2.5", "65536"] {
        assert_eq!(extract_tags(&HashMap::from([("disc".into(), value.into())])).disc, None);
    }
}
