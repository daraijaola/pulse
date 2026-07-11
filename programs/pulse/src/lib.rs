//! PULSE — reaction battle room on Solana + MagicBlock Ephemeral Rollups.
//! Flow: create_room → (optional join) → start_round → delegate → tap (ER) → settle/undelegate

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;

declare_id!("PuLsE11111111111111111111111111111111111111");

pub const ROOM_SEED: &[u8] = b"room";

/// Room status
pub const STATUS_OPEN: u8 = 0;
pub const STATUS_READY: u8 = 1;
pub const STATUS_LIVE: u8 = 2;
pub const STATUS_SETTLED: u8 = 3;

#[ephemeral]
#[program]
pub mod pulse {
    use super::*;

    /// Host creates a room with a 4-byte code (ASCII, e.g. "A3K9").
    pub fn create_room(ctx: Context<CreateRoom>, code: [u8; 4]) -> Result<()> {
        let room = &mut ctx.accounts.room;
        room.host = ctx.accounts.host.key();
        room.challenger = Pubkey::default();
        room.code = code;
        room.status = STATUS_READY;
        room.host_score = 0;
        room.challenger_score = 0;
        room.host_ms = 0;
        room.challenger_ms = 0;
        room.go_ts = 0;
        room.bump = ctx.bumps.room;
        room.winner = 0; // 0 none, 1 host, 2 challenger, 3 draw
        msg!("room created code={:?} host={}", code, room.host);
        Ok(())
    }

    /// Second player joins (optional — solo uses ghost off-chain).
    pub fn join_room(ctx: Context<JoinRoom>) -> Result<()> {
        let room = &mut ctx.accounts.room;
        require!(room.status == STATUS_READY || room.status == STATUS_OPEN, PulseError::BadStatus);
        require!(room.challenger == Pubkey::default(), PulseError::RoomFull);
        require!(
            ctx.accounts.challenger.key() != room.host,
            PulseError::HostCannotJoin
        );
        room.challenger = ctx.accounts.challenger.key();
        room.status = STATUS_READY;
        msg!("challenger joined {}", room.challenger);
        Ok(())
    }

    /// Start round: set LIVE + go timestamp (client enforces wait; upgrade path = VRF).
    pub fn start_round(ctx: Context<StartRound>, go_delay_ms: u32) -> Result<()> {
        let room = &mut ctx.accounts.room;
        require!(
            room.status == STATUS_READY || room.status == STATUS_SETTLED,
            PulseError::BadStatus
        );
        require!(
            ctx.accounts.payer.key() == room.host || ctx.accounts.payer.key() == room.challenger,
            PulseError::NotPlayer
        );

        let now = Clock::get()?.unix_timestamp;
        // go_delay_ms applied client-side for UX; store absolute go_ts if delay known
        room.go_ts = now.saturating_add((go_delay_ms / 1000) as i64);
        room.status = STATUS_LIVE;
        room.host_score = 0;
        room.challenger_score = 0;
        room.host_ms = 0;
        room.challenger_ms = 0;
        room.winner = 0;
        msg!("round live go_ts={}", room.go_ts);
        Ok(())
    }

    /// Delegate room PDA to Ephemeral Rollup for low-latency taps.
    pub fn delegate_room(ctx: Context<DelegateRoom>, code: [u8; 4]) -> Result<()> {
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[ROOM_SEED, code.as_ref()],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|a| a.key()),
                ..Default::default()
            },
        )?;
        msg!("room delegated code={:?}", code);
        Ok(())
    }

    /// Record a tap. reaction_ms = ms after GO. First valid / better score wins.
    /// Intended to run on ER after delegate.
    pub fn tap(ctx: Context<Tap>, reaction_ms: u32) -> Result<()> {
        let room = &mut ctx.accounts.room;
        require!(room.status == STATUS_LIVE, PulseError::BadStatus);
        require!(reaction_ms > 0 && reaction_ms < 60_000, PulseError::BadReaction);

        let who = ctx.accounts.player.key();
        let score = 1000u32.saturating_sub(reaction_ms.min(1000));

        if who == room.host {
            require!(room.host_ms == 0, PulseError::AlreadyTapped);
            room.host_ms = reaction_ms;
            room.host_score = score;
        } else if who == room.challenger {
            require!(room.challenger != Pubkey::default(), PulseError::NotPlayer);
            require!(room.challenger_ms == 0, PulseError::AlreadyTapped);
            room.challenger_ms = reaction_ms;
            room.challenger_score = score;
        } else {
            return err!(PulseError::NotPlayer);
        }

        msg!("tap who={} ms={} score={}", who, reaction_ms, score);
        Ok(())
    }

    /// Solo / demo: host writes both host + ghost scores, then settle locally.
    pub fn tap_solo(ctx: Context<Tap>, host_ms: u32, ghost_ms: u32) -> Result<()> {
        let room = &mut ctx.accounts.room;
        require!(room.status == STATUS_LIVE, PulseError::BadStatus);
        require!(ctx.accounts.player.key() == room.host, PulseError::NotPlayer);
        require!(host_ms > 0 && host_ms < 60_000, PulseError::BadReaction);
        require!(ghost_ms > 0 && ghost_ms < 60_000, PulseError::BadReaction);

        room.host_ms = host_ms;
        room.challenger_ms = ghost_ms;
        room.host_score = 1000u32.saturating_sub(host_ms.min(1000));
        room.challenger_score = 1000u32.saturating_sub(ghost_ms.min(1000));
        msg!("solo tap host_ms={} ghost_ms={}", host_ms, ghost_ms);
        Ok(())
    }

    /// Finalize winner (call on ER then commit_and_undelegate).
    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        let room = &mut ctx.accounts.room;
        require!(room.status == STATUS_LIVE, PulseError::BadStatus);

        // Need at least host tap
        require!(room.host_ms > 0, PulseError::NoTaps);

        if room.challenger_ms == 0 {
            room.winner = 1; // host only
        } else if room.host_ms < room.challenger_ms {
            room.winner = 1;
        } else if room.challenger_ms < room.host_ms {
            room.winner = 2;
        } else {
            room.winner = 3;
        }
        room.status = STATUS_SETTLED;
        msg!("settled winner={}", room.winner);
        Ok(())
    }

    /// Commit room state from ER to base.
    pub fn commit_room(ctx: Context<CommitRoom>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.room.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    /// Commit + undelegate room back to base layer.
    pub fn undelegate_room(ctx: Context<CommitRoom>) -> Result<()> {
        let room = &mut ctx.accounts.room;
        room.exit(&crate::ID)?;
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.room.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    /// settle + undelegate in one ER path after taps.
    pub fn settle_and_undelegate(ctx: Context<CommitRoom>) -> Result<()> {
        {
            let room = &mut ctx.accounts.room;
            require!(room.status == STATUS_LIVE, PulseError::BadStatus);
            require!(room.host_ms > 0, PulseError::NoTaps);
            if room.challenger_ms == 0 {
                room.winner = 1;
            } else if room.host_ms < room.challenger_ms {
                room.winner = 1;
            } else if room.challenger_ms < room.host_ms {
                room.winner = 2;
            } else {
                room.winner = 3;
            }
            room.status = STATUS_SETTLED;
            room.exit(&crate::ID)?;
        }
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.room.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }
}

// ─── Accounts ─────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(code: [u8; 4])]
pub struct CreateRoom<'info> {
    #[account(
        init,
        payer = host,
        space = 8 + Room::SIZE,
        seeds = [ROOM_SEED, code.as_ref()],
        bump
    )]
    pub room: Account<'info, Room>,
    #[account(mut)]
    pub host: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinRoom<'info> {
    #[account(mut, seeds = [ROOM_SEED, room.code.as_ref()], bump = room.bump)]
    pub room: Account<'info, Room>,
    pub challenger: Signer<'info>,
}

#[derive(Accounts)]
pub struct StartRound<'info> {
    #[account(mut, seeds = [ROOM_SEED, room.code.as_ref()], bump = room.bump)]
    pub room: Account<'info, Room>,
    pub payer: Signer<'info>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(code: [u8; 4])]
pub struct DelegateRoom<'info> {
    pub payer: Signer<'info>,
    /// CHECK: room PDA — delegated to ER
    #[account(mut, del, seeds = [ROOM_SEED, code.as_ref()], bump)]
    pub pda: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Tap<'info> {
    #[account(mut, seeds = [ROOM_SEED, room.code.as_ref()], bump = room.bump)]
    pub room: Account<'info, Room>,
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(mut, seeds = [ROOM_SEED, room.code.as_ref()], bump = room.bump)]
    pub room: Account<'info, Room>,
    pub payer: Signer<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitRoom<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [ROOM_SEED, room.code.as_ref()], bump = room.bump)]
    pub room: Account<'info, Room>,
}

// ─── State ────────────────────────────────────────────────

#[account]
pub struct Room {
    pub host: Pubkey,           // 32
    pub challenger: Pubkey,     // 32
    pub code: [u8; 4],          // 4
    pub status: u8,             // 1
    pub host_score: u32,        // 4
    pub challenger_score: u32,  // 4
    pub host_ms: u32,           // 4
    pub challenger_ms: u32,     // 4
    pub go_ts: i64,             // 8
    pub winner: u8,             // 1  0 none 1 host 2 challenger 3 draw
    pub bump: u8,               // 1
}

impl Room {
    // 32+32+4+1+4+4+4+4+8+1+1 = 95 + padding
    pub const SIZE: usize = 32 + 32 + 4 + 1 + 4 + 4 + 4 + 4 + 8 + 1 + 1 + 16;
}

// ─── Errors ───────────────────────────────────────────────

#[error_code]
pub enum PulseError {
    #[msg("Invalid room status for this action")]
    BadStatus,
    #[msg("Room already has a challenger")]
    RoomFull,
    #[msg("Host cannot join as challenger")]
    HostCannotJoin,
    #[msg("Signer is not a player in this room")]
    NotPlayer,
    #[msg("Player already tapped this round")]
    AlreadyTapped,
    #[msg("Invalid reaction time")]
    BadReaction,
    #[msg("No taps recorded")]
    NoTaps,
}
