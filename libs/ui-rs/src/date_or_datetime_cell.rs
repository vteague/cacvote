#![allow(non_snake_case)]

use dioxus::prelude::*;

use crate::{util::datetime, TableCell};

#[derive(Debug, Props, PartialEq)]
pub struct Props {
    #[props(into)]
    date_or_datetime: datetime::DateOrDateTime,
}

pub fn DateOrDateTimeCell(cx: Scope<Props>) -> Element {
    let date_or_datetime = cx.props.date_or_datetime.clone();
    let formatted = datetime::format(
        &date_or_datetime,
        match date_or_datetime {
            datetime::DateOrDateTime::Date(_) => {
                &datetime::DateFormatOptions::DATE_WITH_DAY_OF_WEEK
            }
            datetime::DateOrDateTime::DateTime(_) => &datetime::DateFormatOptions::DATETIME,
        },
    );
    render!(
        TableCell {
            title: "{date_or_datetime.to_iso8601()}",
            "{formatted}"
        }
    )
}
