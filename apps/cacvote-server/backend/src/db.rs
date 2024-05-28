//! Database access for the application.
//!
//! All direct use of [SQLx][`sqlx`] queries should be in this module. When
//! modifying this file, be sure to run `cargo sqlx prepare --workspace` in the
//! workspace root to regenerate the query metadata for offline builds.
//!
//! To enable `cargo sqlx prepare --workspace`, install it via `cargo install
//! --locked sqlx-cli`.

use std::time::Duration;

use base64_serde::base64_serde_type;
use color_eyre::eyre::bail;
use sqlx::{self, postgres::PgPoolOptions, Connection, PgPool};
use tracing::Level;
use types_rs::cacvote::{
    self, BallotVerificationPayload, JournalEntry, JournalEntryAction, JurisdictionCode,
    SignedBuffer, SignedObject,
};
use uuid::Uuid;

use crate::config::Config;

base64_serde_type!(Base64Standard, base64::engine::general_purpose::STANDARD);

/// Sets up the database pool and runs any pending migrations, returning the
/// pool to be used by the app.
pub async fn setup(config: &Config) -> color_eyre::Result<PgPool> {
    let _entered = tracing::span!(Level::DEBUG, "Setting up database").entered();
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(3))
        .connect(&config.database_url)
        .await?;
    sqlx::migrate!("db/migrations").run(&pool).await?;
    Ok(pool)
}

pub async fn create_object(
    connection: &mut sqlx::PgConnection,
    object: &SignedObject,
) -> color_eyre::Result<Uuid> {
    if !object.verify()? {
        bail!("Unable to verify signature/certificates")
    }

    let Some(jurisdiction_code) = object.jurisdiction_code() else {
        tracing::error!(
            "no jurisdiction found in object: {:?} (try_to_inner={:?})",
            object,
            object.try_to_inner(),
        );
        bail!("No jurisdiction found");
    };

    let object_type = object.try_to_inner()?.object_type();

    let mut txn = connection.begin().await?;

    match sqlx::query!(
        r#"
        INSERT INTO objects (id, election_id, jurisdiction, object_type, payload, certificates, signature)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
        &object.id,
        object.election_id,
        jurisdiction_code.as_str(),
        object_type,
        &object.payload,
        &object.certificates,
        &object.signature
    )
    .execute(&mut *txn)
    .await
    {
        Ok(_) => {}
        Err(e) => {
            txn.rollback().await?;
            bail!("Error creating object: {e}");
        }
    }

    tracing::debug!("Creating object with id {}", object.id);

    let journal_entry = match sqlx::query!(
        r#"
        INSERT INTO journal_entries (object_id, election_id, jurisdiction, object_type, action)
        VALUES ($1, $2, $3, $4, 'create')
        RETURNING id
        "#,
        object.id,
        object.election_id,
        jurisdiction_code.as_str(),
        object_type,
    )
    .fetch_one(&mut *txn)
    .await
    {
        Ok(journal_entry) => journal_entry,
        Err(e) => {
            txn.rollback().await?;
            bail!("Error creating journal entry: {e}");
        }
    };

    tracing::debug!("Creating journal entry with id {}", journal_entry.id);

    txn.commit().await?;

    tracing::debug!("Created object successfully");

    Ok(object.id)
}

pub async fn get_journal_entries(
    connection: &mut sqlx::PgConnection,
    since_journal_entry_id: Option<Uuid>,
    jurisdiction_code: Option<JurisdictionCode>,
) -> color_eyre::Result<Vec<types_rs::cacvote::JournalEntry>> {
    struct Record {
        id: Uuid,
        object_id: Uuid,
        election_id: Option<Uuid>,
        jurisdiction: String,
        object_type: String,
        action: JournalEntryAction,
        created_at: time::OffsetDateTime,
    }

    let entries = match (since_journal_entry_id, jurisdiction_code) {
        (Some(since_journal_entry_id), Some(jurisdiction_code)) => {
            sqlx::query_as!(
                Record,
                r#"
                SELECT
                  id,
                  object_id,
                  election_id,
                  jurisdiction,
                  object_type,
                  action as "action: JournalEntryAction",
                  created_at
                FROM journal_entries
                WHERE created_at > (SELECT created_at FROM journal_entries WHERE id = $1)
                  AND jurisdiction = $2
                ORDER BY created_at
                "#,
                since_journal_entry_id,
                jurisdiction_code.as_str()
            )
            .fetch_all(connection)
            .await?
        }
        (Some(since_journal_entry_id), None) => {
            sqlx::query_as!(
                Record,
                r#"
                SELECT
                  id,
                  object_id,
                  election_id,
                  jurisdiction,
                  object_type,
                  action as "action: JournalEntryAction",
                  created_at
                FROM journal_entries
                WHERE created_at > (SELECT created_at FROM journal_entries WHERE id = $1)
                ORDER BY created_at
                "#,
                since_journal_entry_id
            )
            .fetch_all(connection)
            .await?
        }
        (None, Some(jurisdiction_code)) => {
            sqlx::query_as!(
                Record,
                r#"
                SELECT
                  id,
                  object_id,
                  election_id,
                  jurisdiction,
                  object_type,
                  action as "action: JournalEntryAction",
                  created_at
                FROM journal_entries
                WHERE jurisdiction = $1
                ORDER BY created_at
                "#,
                jurisdiction_code.as_str()
            )
            .fetch_all(connection)
            .await?
        }
        (None, None) => {
            sqlx::query_as!(
                Record,
                r#"
                SELECT
                  id,
                  object_id,
                  election_id,
                  jurisdiction,
                  object_type,
                  action as "action: JournalEntryAction",
                  created_at
                FROM journal_entries
                ORDER BY created_at
                "#,
            )
            .fetch_all(connection)
            .await?
        }
    };

    entries
        .into_iter()
        .map(|entry| {
            Ok(JournalEntry {
                id: entry.id,
                object_id: entry.object_id,
                election_id: entry.election_id,
                jurisdiction_code: entry.jurisdiction.try_into().unwrap(),
                object_type: entry.object_type,
                action: entry.action,
                created_at: entry.created_at,
            })
        })
        .collect::<color_eyre::Result<Vec<_>>>()
}

pub async fn get_object_by_id(
    connection: &mut sqlx::PgConnection,
    object_id: Uuid,
) -> color_eyre::Result<Option<SignedObject>> {
    let object = sqlx::query_as!(
        cacvote::SignedObject,
        r#"
        SELECT id, election_id, payload, certificates, signature
        FROM objects
        WHERE id = $1
        "#,
        object_id
    )
    .fetch_optional(connection)
    .await?;

    // Ensure the denormalized election_id field matches the election_id in the
    // payload. The denormalized field is used for fast lookups, but isn't part
    // of the signed payload.
    if let Some(object) = &object {
        let payload = object.try_to_inner()?;
        assert_eq!(
            object.election_id,
            payload.election_id(),
            "denormalized election_id field does not match election_id in payload: {payload:?}"
        );
    }

    Ok(object)
}

pub(crate) async fn get_election_ids(
    connection: &mut sqlx::PgConnection,
) -> color_eyre::Result<Vec<Uuid>> {
    let object = sqlx::query!(
        r#"
        SELECT id
        FROM objects
        WHERE object_type = $1
        "#,
        cacvote::Payload::election_object_type(),
    )
    .fetch_all(connection)
    .await?;

    Ok(object.into_iter().map(|object| object.id).collect())
}

pub(crate) async fn get_cast_ballot_ids_by_election(
    connection: &mut sqlx::PgConnection,
    election_id: Uuid,
) -> color_eyre::Result<Vec<Uuid>> {
    let records = sqlx::query!(
        r#"
        SELECT id
        FROM objects
        WHERE object_type = $1
          AND election_id = $2
        "#,
        cacvote::Payload::cast_ballot_object_type(),
        election_id
    )
    .fetch_all(connection)
    .await?;

    Ok(records.into_iter().map(|record| record.id).collect())
}

pub(crate) async fn get_object_by_election_id_and_type(
    conn: &mut sqlx::PgConnection,
    election_id: Uuid,
    object_type: &str,
) -> color_eyre::Result<Option<SignedObject>> {
    Ok(sqlx::query_as!(
        cacvote::SignedObject,
        r#"
            SELECT id, election_id, payload, certificates, signature
            FROM objects
            WHERE election_id = $1
              AND object_type = $2
            "#,
        election_id,
        object_type,
    )
    .fetch_optional(conn)
    .await?)
}

pub(crate) async fn get_machine_id_by_identifier(
    conn: &mut sqlx::PgConnection,
    identifier: &str,
) -> color_eyre::Result<Option<Uuid>> {
    Ok(sqlx::query!(
        r#"
        SELECT id
        FROM machines
        WHERE machine_identifier = $1
        "#,
        identifier,
    )
    .fetch_optional(conn)
    .await?
    .map(|record| record.id))
}

pub(crate) async fn create_scanned_mailing_label_code(
    conn: &mut sqlx::PgConnection,
    ballot_verification_payload: &[u8],
) -> color_eyre::Result<Uuid> {
    let mut txn = conn.begin().await?;
    let original_payload = ballot_verification_payload;
    let signed_buffer: SignedBuffer = tlv::from_slice(original_payload)?;

    // TODO: do something with `signed_buffer.signature()`?
    let ballot_verification_payload: BallotVerificationPayload =
        tlv::from_slice(signed_buffer.buffer())?;

    let Some(machine_id) =
        get_machine_id_by_identifier(&mut txn, ballot_verification_payload.machine_id()).await?
    else {
        bail!(
            "Machine with identifier {} not found",
            ballot_verification_payload.machine_id()
        );
    };

    let record = sqlx::query!(
        r#"
        INSERT INTO scanned_mailing_label_codes (
            election_id,
            machine_id,
            common_access_card_id,
            encrypted_ballot_signature_hash,
            original_payload
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        "#,
        ballot_verification_payload.election_object_id(),
        machine_id,
        ballot_verification_payload.common_access_card_id(),
        ballot_verification_payload.encrypted_ballot_signature_hash(),
        original_payload,
    )
    .fetch_one(&mut *txn)
    .await?;

    txn.commit().await?;

    Ok(record.id)
}