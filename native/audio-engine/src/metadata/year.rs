//! Calendar-year interpretation of FFmpeg's normalized date metadata.

/// Read a four-digit calendar year without timezone conversion or substring guessing.
pub fn parse_year(raw: &str) -> Option<u32> {
    let value = raw.trim();
    let digits = |part: &str| !part.is_empty() && part.bytes().all(|c| c.is_ascii_digit());
    let year = |part: &str| {
        if part.len() != 4 || !digits(part) {
            return None;
        }
        part.parse::<u32>().ok().filter(|year| *year > 0)
    };
    if value.len() == 4 {
        return year(value);
    }
    if value.len() == 8 && digits(value) {
        let y = year(&value[..4])?;
        return valid_date(y, value[4..6].parse().ok()?, value[6..].parse().ok()?).then_some(y);
    }
    let (date, time) = value
        .split_once(['T', 't', ' '])
        .map_or((value, None), |(d, t)| (d, Some(t)));
    let separator = ['-', '/', '.']
        .into_iter()
        .find(|sep| date.contains(*sep))?;
    let parts: Vec<_> = date.split(separator).collect();
    if !parts.iter().all(|p| digits(p)) {
        return None;
    }
    let result = if parts.len() == 2 && parts[0].len() == 4 {
        let y = year(parts[0])?;
        let month = parts[1].parse::<u32>().ok()?;
        (parts[1].len() <= 2 && (1..=12).contains(&month)).then_some(y)
    } else if parts.len() == 3 && parts[0].len() == 4 {
        let y = year(parts[0])?;
        (parts[1].len() <= 2
            && parts[2].len() <= 2
            && valid_date(y, parts[1].parse().ok()?, parts[2].parse().ok()?))
        .then_some(y)
    } else if parts.len() == 3 && parts[2].len() == 4 {
        let y = year(parts[2])?;
        let a = parts[0].parse().ok()?;
        let b = parts[1].parse().ok()?;
        (parts[0].len() <= 2 && parts[1].len() <= 2 && (valid_date(y, a, b) || valid_date(y, b, a)))
            .then_some(y)
    } else {
        None
    }?;
    if let Some(time) = time {
        if !valid_time(time) {
            return None;
        }
    }
    Some(result)
}

/// Validate Gregorian calendar dates, including leap days.
fn valid_date(year: u32, month: u32, day: u32) -> bool {
    let leap = year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400));
    let days = match month {
        2 => {
            if leap {
                29
            } else {
                28
            }
        }
        4 | 6 | 9 | 11 => 30,
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        _ => return false,
    };
    (1..=days).contains(&day)
}

/// Validate an ISO time suffix so arbitrary prose cannot become a date.
fn valid_time(raw: &str) -> bool {
    let raw = raw.strip_suffix(['Z', 'z']).unwrap_or(raw);
    let (clock, zone) = raw
        .split_once(['+', '-'])
        .map_or((raw, None), |(c, z)| (c, Some(z)));
    if let Some(zone) = zone {
        let parts: Vec<_> = zone.split(':').collect();
        if parts.len() != 2
            || parts
                .iter()
                .any(|p| p.len() != 2 || !p.bytes().all(|c| c.is_ascii_digit()))
            || parts[0].parse::<u32>().unwrap_or(99) > 23
            || parts[1].parse::<u32>().unwrap_or(99) > 59
        {
            return false;
        }
    }
    let parts: Vec<_> = clock.split(':').collect();
    if parts.is_empty() || parts.len() > 3 {
        return false;
    }
    parts.iter().enumerate().all(|(i, part)| {
        let whole = if i == 2 {
            part.split_once('.').map_or(*part, |(s, f)| {
                if !f.is_empty() && f.bytes().all(|c| c.is_ascii_digit()) {
                    s
                } else {
                    ""
                }
            })
        } else {
            part
        };
        whole.len() == 2
            && whole.bytes().all(|c| c.is_ascii_digit())
            && whole
                .parse::<u32>()
                .is_ok_and(|v| v <= if i == 0 { 23 } else { 59 })
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_explicit_calendar_formats() {
        for value in [
            "2024",
            " 2024 ",
            "2024-02",
            "2024-02-29",
            "2024/2/29",
            "2024.02.29",
            "29/02/2024",
            "02/29/2024",
            "20240229",
            "2024-12-31T23:30:59.123-05:30",
            "2024-01-01T00:00Z",
        ] {
            assert_eq!(parse_year(value), Some(2024), "{value}");
        }
    }
    #[test]
    fn rejects_unknown_invalid_and_incidental_numbers() {
        for value in [
            "",
            "0000",
            "99",
            "2023-02-29",
            "20241301",
            "2024-13",
            "2024-00-01",
            "2024-01-00",
            "Copyright 2024",
            "2024 remaster",
            "2024-01-01T99:00",
            "2024-01-01T00:00junk",
            "2024-2025",
            "２０２４",
            "12345",
        ] {
            assert_eq!(parse_year(value), None, "{value}");
        }
    }
}
