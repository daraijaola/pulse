#!/usr/bin/env python3
"""Generate PULSE Solana Blitz v6 master brief PDF for expert FE handoff."""

from pathlib import Path

from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    ListFlowable,
    ListItem,
    KeepTogether,
    HRFlowable,
)

OUT = Path(__file__).resolve().parent / "PULSE-Blitz-v6-Master-Brief.pdf"

NAVY = HexColor("#000f1d")
BLUE = HexColor("#4da2ff")
LIGHT = HexColor("#f7f7f7")
GRAY = HexColor("#61686d")
MUTED = HexColor("#31404e")


def styles():
    base = getSampleStyleSheet()
    s = {}
    s["cover_title"] = ParagraphStyle(
        "cover_title",
        parent=base["Title"],
        fontName="Helvetica-Bold",
        fontSize=28,
        leading=32,
        textColor=NAVY,
        spaceAfter=8,
        alignment=TA_LEFT,
    )
    s["cover_sub"] = ParagraphStyle(
        "cover_sub",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=11,
        leading=15,
        textColor=GRAY,
        spaceAfter=6,
    )
    s["h1"] = ParagraphStyle(
        "h1",
        parent=base["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        textColor=NAVY,
        spaceBefore=14,
        spaceAfter=8,
    )
    s["h2"] = ParagraphStyle(
        "h2",
        parent=base["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12.5,
        leading=16,
        textColor=NAVY,
        spaceBefore=10,
        spaceAfter=5,
    )
    s["h3"] = ParagraphStyle(
        "h3",
        parent=base["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=13,
        textColor=MUTED,
        spaceBefore=8,
        spaceAfter=4,
    )
    s["body"] = ParagraphStyle(
        "body",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=9.2,
        leading=12.5,
        textColor=black,
        alignment=TA_JUSTIFY,
        spaceAfter=5,
    )
    s["bullet"] = ParagraphStyle(
        "bullet",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=black,
        leftIndent=4,
        spaceAfter=2,
    )
    s["mono"] = ParagraphStyle(
        "mono",
        parent=base["Code"],
        fontName="Courier",
        fontSize=7.8,
        leading=10.5,
        textColor=NAVY,
        backColor=LIGHT,
        leftIndent=4,
        rightIndent=4,
        spaceBefore=4,
        spaceAfter=6,
    )
    s["prompt"] = ParagraphStyle(
        "prompt",
        parent=base["Normal"],
        fontName="Courier",
        fontSize=7.4,
        leading=10,
        textColor=NAVY,
        alignment=TA_LEFT,
        spaceAfter=3,
    )
    s["caption"] = ParagraphStyle(
        "caption",
        parent=base["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8,
        leading=10,
        textColor=GRAY,
        spaceAfter=6,
    )
    s["warn"] = ParagraphStyle(
        "warn",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=HexColor("#8a1c1c"),
        spaceBefore=4,
        spaceAfter=6,
    )
    s["center"] = ParagraphStyle(
        "center",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        alignment=TA_CENTER,
        textColor=GRAY,
    )
    return s


def hr():
    return HRFlowable(width="100%", thickness=1, color=NAVY, spaceBefore=4, spaceAfter=8)


def bullets(items, st):
    return ListFlowable(
        [ListItem(Paragraph(i, st["bullet"]), leftIndent=12, bulletColor=NAVY) for i in items],
        bulletType="bullet",
        start="•",
        leftIndent=14,
        bulletFontSize=8,
    )


def kv_table(rows, col_widths=None):
    data = [[Paragraph(f"<b>{a}</b>", ParagraphStyle("k", fontName="Helvetica", fontSize=8, leading=11)),
            Paragraph(b, ParagraphStyle("v", fontName="Helvetica", fontSize=8, leading=11))]
            for a, b in rows]
    t = Table(data, colWidths=col_widths or [42 * mm, 130 * mm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.6, NAVY),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, HexColor("#bbbec0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return t


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(NAVY)
    canvas.setLineWidth(0.6)
    canvas.line(18 * mm, 12 * mm, A4[0] - 18 * mm, 12 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(GRAY)
    canvas.drawString(18 * mm, 7 * mm, "PULSE · Solana Blitz v6 · Master Brief · CONFIDENTIAL TEAM USE")
    canvas.drawRightString(A4[0] - 18 * mm, 7 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build():
    st = styles()
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title="PULSE — Solana Blitz v6 Master Brief + Expert FE Prompt Pack",
        author="Team Pulse / daraijaola",
    )
    story = []

    # ─── COVER ───
    story.append(Paragraph("PULSE", st["cover_title"]))
    story.append(Paragraph(
        "Solana Blitz v6 · Master Product, Hackathon, Infrastructure &amp; Expert Frontend Prompt Pack",
        st["cover_sub"],
    ))
    story.append(Paragraph(
        "Purpose: hand this single PDF to a specialist frontend / mobile UI AI. It must contain every fact needed "
        "to ship a competition-grade mobile-first product without re-asking product questions. "
        "Start with the landing page only. Refine until perfect before deploy.",
        st["body"],
    ))
    story.append(hr())
    story.append(kv_table([
        ("Document version", "1.0 — 2026-07-11"),
        ("Product codename", "PULSE"),
        ("Hackathon", "Solana Blitz v6 (MagicBlock)"),
        ("Theme", "Mobile"),
        ("Primary prize path", "1st place $500 USDC reserved for best mobile project"),
        ("Repo", "https://github.com/daraijaola/pulse"),
        ("Live preview (VM)", "https://agentr.online/sites/pulse/"),
        ("Local path", "C:\\Users\\HP\\pulse"),
        ("Stack (FE)", "Vite + React + TypeScript · mobile-first PWA"),
        ("Theme reference site", "https://overflow.sui.io/ (visual system only — do NOT brand as Overflow)"),
    ]))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>Critical process rule:</b> Do NOT one-shot and ship. Design → self-critique → refine → hard-check on "
        "phone viewport → only then deploy to VM. If it is not perfect, redo.",
        st["warn"],
    ))

    # ─── 1 HACKATHON ───
    story.append(Paragraph("1. Hackathon details (complete)", st["h1"]))
    story.append(hr())
    story.append(Paragraph("1.1 Event identity", st["h2"]))
    story.append(kv_table([
        ("Name", "Solana Blitz v6"),
        ("Host / presenter", "MagicBlock Team"),
        ("Series", "Weekend hackathon series for real-time apps on Solana"),
        ("Format", "Fully virtual"),
        ("Category", "Crypto / Solana / mobile-first"),
        ("Registration Luma", "https://luma.com/zsdnlbnt"),
        ("Hackathon hub", "https://hackathon.magicblock.app/"),
        ("MagicBlock site", "https://www.magicblock.xyz/"),
        ("Docs", "https://docs.magicblock.gg/"),
        ("Calendar", "https://luma.com/magicblock-events"),
        ("Telegram support", "https://t.me/+oLOcE79hoqo3OWJi"),
        ("WorkAdventure cowork", "https://play.workadventu.re/@/blitz/blitz/small-office (or MagicBlock office link on Luma)"),
        ("RFP ideas (optional)", "Notion RFP board linked from hackathon.magicblock.app"),
    ]))

    story.append(Paragraph("1.2 Dates &amp; clock", st["h2"]))
    story.append(kv_table([
        ("Build window", "Friday 10 July 2026 → Sunday 12 July 2026"),
        ("Luma start_at (UTC)", "2026-07-10T15:00:00.000Z"),
        ("Luma end_at (UTC)", "2026-07-12T15:00:00.000Z"),
        ("Event timezone label", "Asia/Hong_Kong on Luma event object"),
        ("Hub copy (approx)", "Monthly · Friday to Sunday · Asia/Singapore (series framing)"),
        ("Hard deadline", "Treat Sunday ~15:00 UTC as death; submit earlier. MagicBlock X also cited Sunday ~2PM UTC for prior messaging — verify submission Luma event."),
        ("Submission channel", "Luma event: “Submission: Solana Blitz v6” on MagicBlock calendar"),
        ("Submit package", "GitHub repo + short demo video and/or live link"),
    ]))

    story.append(Paragraph("1.3 Prizes ($1,000 USDC pool)", st["h2"]))
    story.append(kv_table([
        ("1st", "$500 USDC — Luma: best mobile build"),
        ("2nd", "$250 USDC"),
        ("3rd", "$150 USDC"),
        ("Wizardio’s Choice", "$100 USDC"),
    ]))
    story.append(Paragraph(
        "Eligibility (facts from Luma + hub): Projects should integrate MagicBlock <b>Ephemeral Rollups (ER)</b> "
        "and/or <b>Private ERs</b>. First prize is framed around the best mobile project. Judging: creativity, "
        "technical depth, how compellingly the project showcases what is possible on Solana with MagicBlock.",
        st["body"],
    ))

    story.append(Paragraph("1.4 Participation logistics", st["h2"]))
    story.append(bullets([
        "Register on Luma (wallet / Solana address verification may be required).",
        "Registration questions historically include Telegram username, GitHub username, optional X handle.",
        "Solo allowed; teams up to ~4 mentioned in MagicBlock communications.",
        "Partners called out for v6 mobile edition: Solana Mobile + Blueshift (orientation resources).",
        "Mobile docs: https://docs.solanamobile.com/ · Blueshift Mobile Mastery path on learn.blueshift.gg",
        "Luma “Going” count is RSVPs/tickets — not guaranteed submissions. Past Blitz editions shipped ~30–40 projects.",
        "Post-Blitz path: MagicBlock Forge (rolling program) for strong builders.",
    ], st))

    story.append(Paragraph("1.5 MagicBlock product surface (what judges reward)", st["h2"]))
    story.append(bullets([
        "Ephemeral Rollup (ER): high-frequency / real-time execution, delegate → act on ER → commit / undelegate to base layer.",
        "Private Ephemeral Rollup (PER): privacy / TEE path (optional for us unless stretch).",
        "VRF: verifiable onchain randomness (official roll-dice examples).",
        "Magic Router + regional ER RPCs (devnet free endpoints documented).",
        "Official examples: https://github.com/magicblock-labs/magicblock-engine-examples (counter, roll-dice, session keys, etc.).",
        "Dev skill (optional for agents): magicblock-dev-skill on GitHub.",
    ], st))

    story.append(Paragraph("1.6 Past winners — patterns to beat (facts)", st["h2"]))
    story.append(Paragraph(
        "<b>v5 (Jun 12–14 2026, trading, ~34 apps):</b> 1st Ghost Stops — ER recomputes triggers every tick; "
        "2nd Eclipse — private state in ER; Wizardio EPOCH — market as ER session. "
        "<b>v3:</b> privRoll private payroll via PER/Payment API. "
        "Win pattern: one sharp mechanic + MagicBlock primitive is load-bearing + live demo + repo.",
        st["body"],
    ))

    story.append(Paragraph("1.7 Official dev endpoints (devnet)", st["h2"]))
    story.append(Paragraph(
        "Magic Router: https://devnet-router.magicblock.app<br/>"
        "ER (Asia example): https://devnet-as.magicblock.app · wss://devnet-as.magicblock.app<br/>"
        "Solana Devnet: https://api.devnet.solana.com<br/>"
        "Asia ER validator pubkey: MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57",
        st["mono"],
    ))

    # ─── 2 PRODUCT ───
    story.append(PageBreak())
    story.append(Paragraph("2. Product: PULSE (complete build brief)", st["h1"]))
    story.append(hr())
    story.append(Paragraph("2.1 One-liner &amp; thesis", st["h2"]))
    story.append(Paragraph(
        "<b>PULSE</b> is a mobile-first real-time reaction battle game on Solana. "
        "Players wait for a fair pulse signal, tap as fast as possible, and win the round. "
        "Room state and taps run on a <b>MagicBlock Ephemeral Rollup</b>. "
        "The GO timing uses <b>MagicBlock VRF</b> (not browser Math.random). "
        "The result commits to the Solana base layer.",
        st["body"],
    ))
    story.append(Paragraph(
        "Judge sentence: “Wait for a fair pulse → tap first → win — live on ER, settled on Solana — built for the phone.”",
        st["body"],
    ))

    story.append(Paragraph("2.2 Core loop (canonical)", st["h2"]))
    story.append(bullets([
        "Open on phone browser / PWA.",
        "Create room OR join with 4-character code.",
        "Lobby: show code, you vs opponent (or Ghost bot for solo demo).",
        "Start round → delegate room account to Ephemeral Rollup.",
        "Request VRF → fair pulse / GO moment.",
        "WAIT phase (no early valid tap) → GO phase → player TAP (ER high-frequency tx).",
        "Score: reaction time / first valid tap (ghost opponent for solo).",
        "Commit / undelegate → winner + scores on base layer.",
        "Result screen → play again or home.",
    ], st))

    story.append(Paragraph("2.3 Frontend screens (build order)", st["h2"]))
    story.append(Paragraph(
        "Work <b>lead-source by lead-source</b>: finish one screen to perfection before the next. "
        "Current priority: <b>Landing first</b>.",
        st["body"],
    ))

    story.append(Paragraph("Screen A — Landing (PRIORITY 1)", st["h3"]))
    story.append(bullets([
        "Purpose: sell the product in &lt;5 seconds on a phone; create desire to play.",
        "Must feel competition-winning UI: simple AND fire — not empty, not cluttered, not rainbow spam.",
        "Must use Overflow visual system (tokens, type, hard chrome) WITHOUT saying “Overflow” on screen.",
        "Must communicate the game (wait → pulse → tap → win) via designed motion / hero object — not a cheap mock dashboard.",
        "Primary CTA → Enter arena / Play (goes to Enter flow).",
        "Only product facts that matter (prefer 2 strong facts): fair pulse (VRF); live ER → Solana settle.",
        "No game dock chrome on landing. No fake score spam. No theme attribution footer.",
        "Logo: temporary wordmark OK; final logo later.",
        "Success bar: human team lead says “perfect” after phone review. Iterate until then.",
    ], st))

    story.append(Paragraph("Screen B — Enter (create / join)", st["h3"]))
    story.append(bullets([
        "Create room (generates code) → Lobby.",
        "Join with code input (uppercase mono, 3–6 chars) → Lobby.",
        "Back to landing.",
        "Overflow buttons (navy primary + blue icon strip + diagonal arrow).",
    ], st))

    story.append(Paragraph("Screen C — Lobby", st["h3"]))
    story.append(bullets([
        "Huge readable room code (camera / share).",
        "You vs Opponent/Ghost status cards.",
        "Start round CTA; Leave.",
        "Optional one-line MagicBlock flow hint (delegate next).",
        "App chrome: top brand bar + bottom dock OK here (not on landing).",
    ], st))

    story.append(Paragraph("Screen D — Arena", st["h3"]))
    story.append(bullets([
        "Status line phases: delegating → VRF → waiting → GO → tapped → settling.",
        "Large thumb TAP target centered; designed pulse/signal object.",
        "Live scores you vs opp.",
        "Must work for phone recording (demo video).",
        "ER-visible UX (labels / phase badge) without clutter.",
    ], st))

    story.append(Paragraph("Screen E — Result", st["h3"]))
    story.append(bullets([
        "Win / lose state, reaction ms, scores.",
        "Play again / Home.",
        "Optional short “judge line” about MagicBlock (not theme plagiarism).",
    ], st))

    story.append(Paragraph("2.4 In scope / out of scope", st["h2"]))
    story.append(Paragraph("<b>IN (MVP)</b>", st["h3"]))
    story.append(bullets([
        "Mobile-first PWA web app (Vite + React + TS).",
        "Wallet connect (Phantom / mobile wallet browser) when wiring chain.",
        "Onchain room + ER + VRF + settle (devnet first).",
        "Ghost opponent for solo demo.",
        "Deploy on team VM under /sites/pulse/ with basePath /sites/pulse/.",
        "README / demo script for judges.",
    ], st))
    story.append(Paragraph("<b>OUT</b>", st["h3"]))
    story.append(bullets([
        "Native Seeker/Android as MVP requirement (PWA first).",
        "Token economy, betting, NFT mints, leaderboards backend, chat.",
        "Multi-mode game catalog.",
        "Claiming we reimplemented memory/randomness without MagicBlock.",
    ], st))

    story.append(Paragraph("2.5 On-chain model (target)", st["h2"]))
    story.append(Paragraph(
        "Room PDA fields (target): host, players[2], status, vrf_seed / pulse timing, winner, scores[]. "
        "Instructions (target): initialize_room, join_room, delegate_room, request_pulse (VRF), "
        "callback_pulse, tap (ER), commit_result / undelegate. "
        "Fork patterns from magicblock-engine-examples: counter (delegate/commit) + roll-dice (VRF).",
        st["body"],
    ))

    story.append(Paragraph("2.6 Design system — Overflow reference (FACTS)", st["h2"]))
    story.append(Paragraph(
        "Study and match the visual language of <b>https://overflow.sui.io/</b> (Webflow CSS tokens). "
        "This is a design reference only. Do not put Overflow logos, “Overflow system”, or Sui branding in the product.",
        st["body"],
    ))
    story.append(Paragraph("Color tokens (verbatim from Overflow shared CSS)", st["h3"]))
    story.append(Paragraph(
        "--color--blue-900: #000f1d (primary ink / navy)<br/>"
        "--color--blue-700: #4da2ff<br/>"
        "--color--blue-500: deepskyblue<br/>"
        "--color--blue-400: #6de6f8<br/>"
        "--color--light: #f7f7f7 (page bg)<br/>"
        "--color--gray-200: #dfdfdf · gray-400: #bbbec0 · gray-700: #61686d · gray-800: #31404e<br/>"
        "--color--orange-700: #ff7a00 · orange-200: #f2eee4 (use sparingly)<br/>"
        "--color--pink-700: #ff6ada · pink-400: #e9ccff · pink-200: #dbcdeb (use sparingly)<br/>"
        "--color--purple-700: #5c4ade · yellow-900: #ffd731 · green-200: #55db9c · green-700: #3e512f<br/>"
        "Primary UI palette for PULSE landing: navy + light + blue-700 only (restrained). Accents only if earned.",
        st["mono"],
    ))
    story.append(Paragraph("Typography", st["h3"]))
    story.append(bullets([
        "Primary: TWK Everett (Regular 400, Medium 500) — files in app/public/fonts/",
        "Mono: TWK Everett Mono Regular — labels, phase words, codes",
        "Tracking: large display titles ~ -0.05em; mono uppercase small labels with letter-spacing",
        "Font files already hosted: TWKEverett-Regular.otf, TWKEverett-Medium.otf, TWKEverettMono-Regular.otf",
    ], st))
    story.append(Paragraph("Chrome language", st["h3"]))
    story.append(bullets([
        "2px hard borders in navy (#000f1d) — no soft glassmorphism.",
        "Buttons: full-width navy bar + blue icon strip + arrow rotated -45deg (Overflow CTA language).",
        "Easing: cubic-bezier(0.525, 0, 0, 1).",
        "Background: light #f7f7f7 + blue grid SVG (public/grid-blue.svg) at controlled opacity/size.",
        "Selection: blue-700 background, navy text.",
        "Keycap-style elevation (face + side block) for iconic objects if used.",
        "Avoid rainbow key spam on landing; avoid empty minimalism; avoid fake “live preview” scoreboards that look mock.",
    ], st))
    story.append(Paragraph("Assets on disk", st["h3"]))
    story.append(Paragraph(
        "C:\\Users\\HP\\pulse\\app\\public\\fonts\\*.otf<br/>"
        "C:\\Users\\HP\\pulse\\app\\public\\grid-blue.svg<br/>"
        "C:\\Users\\HP\\pulse\\app\\public\\grid-orange.svg<br/>"
        "C:\\Users\\HP\\pulse\\app\\src\\theme.css (token file)<br/>"
        "Overflow source CSS (study): "
        "https://cdn.prod.website-files.com/67acdc4f394bcf4f3e3669b6/css/"
        "sui-overflow-2-staging-ea69dc13ced32828.webflow.shared.50db99ae7.css",
        st["mono"],
    ))

    story.append(Paragraph("2.7 Quality bar (team standard)", st["h2"]))
    story.append(bullets([
        "Mobile-first portrait ~390×844; max content width ~430px.",
        "Must look premium enough to win a mobile-themed hackathon UI review.",
        "Demo will be recorded on a real phone — thumb reach, safe areas, readable type.",
        "If design is “ok” or “simple empty”, it fails. Must be fire + clean + fact-based.",
        "Self-verify on phone viewport before any deploy claim.",
        "Human lead final approval before GitHub push of “perfect” landing.",
    ], st))

    # ─── 3 VM ───
    story.append(PageBreak())
    story.append(Paragraph("3. Virtual machine &amp; deploy environment", st["h1"]))
    story.append(hr())
    story.append(Paragraph(
        "All live previews for the team happen on the existing production VM (same stack used for RECALL).",
        st["body"],
    ))
    story.append(kv_table([
        ("SSH host", "ubuntu@51.21.252.153"),
        ("SSH key (Windows)", "C:\\Users\\HP\\Downloads\\cashual.pem"),
        ("Example SSH", 'ssh -i "C:\\Users\\HP\\Downloads\\cashual.pem" -o StrictHostKeyChecking=no ubuntu@51.21.252.153'),
        ("Domain", "https://agentr.online"),
        ("Static sites root", "/var/www/agentr-sites/"),
        ("Nginx rule", "location /sites/ { alias /var/www/agentr-sites/; }"),
        ("PULSE deploy path", "/var/www/agentr-sites/pulse/"),
        ("Public URL", "https://agentr.online/sites/pulse/"),
        ("Vite base", "base: '/sites/pulse/' in vite.config.ts (required for assets)"),
        ("TLS", "Let’s Encrypt certs on agentr.online (nginx)"),
        ("Process manager", "PM2 present (recall-app :3020, supermemory-local, agentr-api, etc.) — PULSE landing is static files under sites/"),
        ("Deploy method", "npm run build locally → scp dist/* to /var/www/agentr-sites/pulse/ → chmod a+rX"),
        ("Do not", "Re-setup entire VM infra; do not break /sites/recall/ or other sites"),
    ]))
    story.append(Paragraph("3.1 Local workspace", st["h2"]))
    story.append(kv_table([
        ("Project root", "C:\\Users\\HP\\pulse"),
        ("FE app", "C:\\Users\\HP\\pulse\\app"),
        ("Plan markdown", "C:\\Users\\HP\\pulse\\PLAN.md"),
        ("GitHub remote", "https://github.com/daraijaola/pulse"),
        ("Git identity (machine)", "daraijaola (credentials in ~/.git-credentials)"),
        ("Node", "v24.x available on builder machine"),
        ("Rust/Anchor", "Not required for pure FE landing polish; required later for onchain program"),
    ]))
    story.append(Paragraph("3.2 Deploy commands (reference)", st["h2"]))
    story.append(Paragraph(
        "cd C:\\Users\\HP\\pulse\\app<br/>"
        "npm install<br/>"
        "npm run build<br/>"
        "ssh -i C:\\Users\\HP\\Downloads\\cashual.pem ubuntu@51.21.252.153 "
        "\"rm -rf /var/www/agentr-sites/pulse/*\"<br/>"
        "scp -i C:\\Users\\HP\\Downloads\\cashual.pem -r dist/* "
        "ubuntu@51.21.252.153:/var/www/agentr-sites/pulse/<br/>"
        "ssh ... \"chmod -R a+rX /var/www/agentr-sites/pulse\"",
        st["mono"],
    ))
    story.append(Paragraph(
        "<b>Deploy policy for expert FE AI:</b> Prefer local preview (npm run dev) + screenshots/self-critique first. "
        "Deploy to VM only after a refinement cycle. Never call first draft “done.” "
        "Hard-refresh / cache-bust when verifying live URL.",
        st["warn"],
    ))

    # ─── 4 REPO STATE ───
    story.append(Paragraph("4. Current codebase state (as of brief)", st["h1"]))
    story.append(hr())
    story.append(bullets([
        "Vite React TS app scaffolded under app/.",
        "Overflow fonts + grids copied into public/.",
        "theme.css holds Overflow CSS variables.",
        "Multiple landing iterations already attempted — quality not yet accepted by team lead.",
        "Expert FE AI should be free to redesign landing from first principles using this brief, "
        "keeping tokens/fonts/paths; do not inherit weak prior UI if better craft requires rewrite.",
        "Onchain program not yet the FE priority; mock game flow allowed on non-landing screens until chain wiring phase.",
    ], st))

    # ─── 5 PROMPTS ───
    story.append(PageBreak())
    story.append(Paragraph("5. Expert AI prompt pack (copy-paste)", st["h1"]))
    story.append(hr())
    story.append(Paragraph(
        "Use these prompts with a specialist frontend / mobile UI model. "
        "Feed this entire PDF (or sections 1–4) as context. "
        "Start with Prompt A only. Do not skip to full app.",
        st["body"],
    ))

    story.append(Paragraph("5.1 Prompt A — Landing page (START HERE)", st["h2"]))
    story.append(Paragraph(
        "You are a world-class mobile product designer AND senior frontend engineer. "
        "You are extremely strict. Average work is failure. “Clean but empty” is failure. "
        "Rainbow clutter is failure. One-shot deploys are failure.<br/><br/>"
        "<b>Team:</b> Small hackathon team shipping PULSE for Solana Blitz v6 (MagicBlock). "
        "Human lead is ruthless on UI quality and records the demo on a real phone. "
        "You work in their repo and deploy only to their VM when the landing is truly ready.<br/><br/>"
        "<b>Mission (this session only):</b> Ship a PERFECT mobile landing page for PULSE. "
        "Nothing else. No full game wiring. No wallet. No backend. Landing only.<br/><br/>"
        "<b>Product facts (do not invent mechanics):</b><br/>"
        "• PULSE = mobile reaction battle: wait for a fair pulse/GO signal → tap first → win the round.<br/>"
        "• Fair GO via MagicBlock VRF (not Math.random).<br/>"
        "• Live room/taps on MagicBlock Ephemeral Rollup; settle winner on Solana.<br/>"
        "• Solo demo uses a ghost opponent later; landing must sell the fantasy now.<br/><br/>"
        "<b>Visual system (mandatory study):</b><br/>"
        "Open and study https://overflow.sui.io/ carefully (type scale, hard 2px navy borders, light #f7f7f7 ground, "
        "navy #000f1d ink, blue #4da2ff accent, keycap language, CTA with blue icon rail + -45° arrow, grid texture). "
        "Also load tokens from app/src/theme.css and fonts in app/public/fonts (TWK Everett + Mono). "
        "Use the Overflow system as craft reference. NEVER put Overflow/Sui logos or the words “Overflow system” in the UI.<br/><br/>"
        "<b>Craft bar:</b><br/>"
        "• Portrait phone-first, safe areas, thumb CTA.<br/>"
        "• Simple AND fire — editorial confidence, not a wireframe, not a toy dashboard.<br/>"
        "• Designed hero motion that embodies wait → hold → TAP → win (cinematic timing, not equal interval spam).<br/>"
        "• Prefer TWO product facts only if you show facts: (1) fair pulse/VRF (2) live ER → Solana settle.<br/>"
        "• No fake multi-color key spam. No “live preview” mock scoreboard chrome unless it is truly beautiful and product-true.<br/>"
        "• Temporary wordmark “PULSE” OK; final logo later.<br/><br/>"
        "<b>Workspace:</b><br/>"
        "• Local: C:\\Users\\HP\\pulse\\app<br/>"
        "• Vite base must remain '/sites/pulse/' for production assets.<br/>"
        "• VM: ubuntu@51.21.252.153 key C:\\Users\\HP\\Downloads\\cashual.pem<br/>"
        "• Deploy target: /var/www/agentr-sites/pulse/ → https://agentr.online/sites/pulse/<br/>"
        "• Do not break other /sites/* projects.<br/><br/>"
        "<b>Process (non-negotiable):</b><br/>"
        "1) Read this brief + current app landing code.<br/>"
        "2) Redesign landing from first principles if needed (rewrite allowed).<br/>"
        "3) Build. Self-critique against Overflow craft + product truth + phone demo.<br/>"
        "4) Refine at least 2–3 hard passes (spacing, motion, type, hierarchy) before deploy.<br/>"
        "5) Only then build + scp to VM. Hard-refresh verify.<br/>"
        "6) If not perfect, iterate again. Do NOT declare done after first upload.<br/>"
        "7) Do not push to GitHub until human lead says the landing is perfect.<br/><br/>"
        "<b>Deliverable:</b> A perfect working landing page at https://agentr.online/sites/pulse/ "
        "that makes a judge want to play, clearly signals the game, and looks like a winning mobile Blitz entry.<br/><br/>"
        "Begin now. Landing only.",
        st["prompt"],
    ))

    story.append(Spacer(1, 8))
    story.append(Paragraph("5.2 Prompt B — After landing is approved (Enter + app shell)", st["h2"]))
    story.append(Paragraph(
        "Continue as the same strict mobile designer/engineer. Landing is locked unless a bug appears.<br/>"
        "Next lead-source: <b>Enter (create/join)</b> then <b>Lobby</b> with Overflow chrome (top bar + dock) consistent with landing tokens. "
        "Huge room code, clear CTAs, ghost opponent labeling. Still no chain required if mocked, but structure must match final product. "
        "Same VM deploy path. Same refine-until-perfect rule. Phone demo first.",
        st["prompt"],
    ))

    story.append(Spacer(1, 8))
    story.append(Paragraph("5.3 Prompt C — Arena + Result (game FE)", st["h2"]))
    story.append(Paragraph(
        "Implement Arena and Result screens to competition quality. Phase UX: delegate → VRF → wait → GO → tap → settle. "
        "TAP target must be thumb-first and beautiful. Motion must feel like the landing Signal language, not a different product. "
        "Mock chain OK; label states truthfully. Then prepare for wallet/ER wiring in a later backend-focused session. "
        "Refine until human lead approval; deploy VM; no rush push.",
        st["prompt"],
    ))

    story.append(Spacer(1, 8))
    story.append(Paragraph("5.4 Prompt D — QA / perfection loop (any screen)", st["h2"]))
    story.append(Paragraph(
        "You are a strict design QA lead. Open the live URL and the code. List defects in hierarchy, spacing, motion, "
        "contrast, phone safe areas, copy truth, and Overflow-token fidelity. Fix only defects. Re-deploy. Repeat until none remain. "
        "Be brutal. “Looks fine” is not a pass.",
        st["prompt"],
    ))

    # ─── 6 CHECKLIST ───
    story.append(Paragraph("6. Handoff checklist", st["h1"]))
    story.append(hr())
    story.append(bullets([
        "□ Expert AI received this PDF + repo access + SSH key path.",
        "□ Overflow site studied; tokens/fonts loaded.",
        "□ Landing only until approved.",
        "□ ≥2 refinement passes before VM deploy.",
        "□ Live URL verified on real phone after hard refresh.",
        "□ Human lead sign-off before git push of landing milestone.",
        "□ Then Enter → Lobby → Arena → Result, one screen at a time.",
        "□ Chain/ER/VRF after FE path is beautiful and demoable.",
        "□ Demo video ≤90s following product loop.",
        "□ Submit on Luma before Sunday deadline with repo + live + video.",
    ], st))

    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "End of master brief. If any fact conflicts with a newer human instruction, human instruction wins — "
        "update this PDF and re-issue.",
        st["center"],
    ))

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    build()
