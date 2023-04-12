use itertools::Itertools;
use serde::Serialize;

use crate::{
    ballot_card::BallotSide,
    election::{ContestId, GridLayout, GridPosition, OptionId},
    geometry::{GridUnit, Point, Rect},
    timing_marks::TimingMarkGrid,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InterpretedContestOptionLayout {
    option_id: OptionId,
    bounds: Rect,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InterpretedContestLayout {
    contest_id: ContestId,
    bounds: Rect,
    options: Vec<InterpretedContestOptionLayout>,
}

fn build_option_layout(
    grid: &TimingMarkGrid,
    grid_position: &GridPosition,
) -> Option<InterpretedContestOptionLayout> {
    // Option bounding box parameters
    // TODO make these configurable in the election definition
    let column_offset: i32 = -9;
    let row_offset: i32 = -1;
    let width: GridUnit = 10;
    let height: GridUnit = 2;

    let clamp_row = |row: i32| -> GridUnit {
        row.clamp(0, grid.geometry.grid_size.height as i32 - 1) as GridUnit
    };
    let clamp_column = |column: i32| -> GridUnit {
        column.clamp(0, grid.geometry.grid_size.width as i32 - 1) as GridUnit
    };

    let bubble_location = grid_position.location();

    let top_left_grid_point: Point<GridUnit> = Point::new(
        clamp_column(bubble_location.column as i32 + column_offset),
        clamp_row(bubble_location.row as i32 + row_offset),
    );
    let bottom_right_grid_point: Point<GridUnit> = Point::new(
        clamp_column(bubble_location.column as i32 + column_offset + width as i32),
        clamp_row(bubble_location.row as i32 + row_offset + height as i32),
    );

    let top_left_subpixel_point =
        grid.point_for_location(top_left_grid_point.x, top_left_grid_point.y)?;
    let bottom_right_subpixel_point = grid.point_for_location(
        bottom_right_grid_point.x as GridUnit,
        bottom_right_grid_point.y as GridUnit,
    )?;

    Some(InterpretedContestOptionLayout {
        option_id: grid_position.option_id(),
        bounds: Rect::from_points(
            top_left_subpixel_point.round(),
            bottom_right_subpixel_point.round(),
        ),
    })
}

pub fn build_interpreted_page_layout(
    grid: &TimingMarkGrid,
    grid_layout: &GridLayout,
    side: BallotSide,
) -> Option<Vec<InterpretedContestLayout>> {
    let contest_ids_in_grid_layout_order = grid_layout
        .grid_positions
        .iter()
        .filter(|grid_position| grid_position.location().side == side)
        .map(|grid_position| grid_position.contest_id())
        .unique()
        .collect::<Vec<_>>();

    contest_ids_in_grid_layout_order
        .iter()
        .map(|contest_id| {
            let grid_positions = grid_layout
                .grid_positions
                .iter()
                .filter(|grid_position| grid_position.contest_id() == *contest_id)
                .collect::<Vec<_>>();

            let options = grid_positions
                .iter()
                .map(|grid_position| build_option_layout(grid, grid_position))
                .collect::<Option<Vec<_>>>()?;

            // Use the union of the option bounds as an approximation of the contest bounds
            let bounds = options
                .iter()
                .map(|option| option.bounds)
                .reduce(|a, b| a.union(&b))
                .expect("Contest must have options");

            Some(InterpretedContestLayout {
                contest_id: contest_id.clone(),
                bounds,
                options,
            })
        })
        .collect()
}
