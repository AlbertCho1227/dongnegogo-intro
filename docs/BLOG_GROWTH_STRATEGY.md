# DongNeGoGo blog growth strategy

Updated: 2026-08-22 KST

This is the operating brief for the public DongNeGoGo blog. The current first
stage exposes a read-only, permanent article surface for qualified education,
culture, art, exhibition, performance, event, sports, hobby, and class records.
Parking is excluded. It does not create or enable an automatic publishing
schedule; cadence automation starts only after the owner approves the launch.

## Objective

- Bring qualified local-program search traffic into DongNeGoGo.
- Help a reader decide and act without copying an institution's notice.
- Convert blog visits into program-detail and map exploration.
- Earn durable search visibility through accuracy, regional depth, and useful
  editorial context rather than publishing volume.

## Initial archive-building stage

- Give each qualified non-parking program a stable article URL backed by the
  existing read-only public program surface.
- Include real poster/program/facility media only when the recorded source or
  verified rights metadata can be shown next to the image.
- Keep ended program URLs and add a visible archive state instead of deleting
  them.
- Submit only content-complete URLs to segmented program sitemaps: region,
  venue, source, useful timing information, and at least one image are required.
- Do not create near-duplicate pages for every keyword variation. One program
  has one canonical article URL.

## Recommended publishing rhythm after archive approval

- First six weeks: one new post per publishing day, six posts per week.
- Monday: education, lifelong learning, AI, or digital skills.
- Tuesday: sports, health, swimming, walking, or senior activity.
- Wednesday: culture, art, exhibition, museum, or library.
- Thursday: children, family, senior, or accessibility-focused programs.
- Friday: weekend performance, festival, or event guide.
- Saturday: one regional roundup that compares three to five current programs.
- Sunday: no new post; refresh changed facts, fix broken links, and review
  search performance.
- Avoid more than two new posts on one day. Increase volume only when quality
  checks and meaningful search demand both support it.

## Geographic mix

- Capital region: 40 percent.
- Non-capital metropolitan and provincial cities: 50 percent.
- Nationwide or online programs: 10 percent.
- Do not repeat the same city on adjacent publishing days unless a deadline or
  exceptional local event makes it genuinely useful.
- Rebalance monthly using impressions, click-through rate, and map conversions.

## Candidate score

Prefer a program when it has more of these qualities:

1. Open now, opening soon, or running long enough for searchers to act.
2. An application deadline between three and twenty-one days away.
3. Clear venue, audience, schedule, cost, and an official destination URL.
4. Free or meaningfully lower-cost public access.
5. Strong intent such as `지역 + 무료 + 대상 + 분야`.
6. A category or region not recently covered.
7. Image reuse rights are explicit, or a DongNeGoGo-owned visual can replace it.

Reject or hold a candidate when its status conflicts across sources, its
official link is broken, its important conditions are missing, or its imagery
has unclear rights and the article would depend on that imagery.

## Content formats

- Single-program guide: key facts, who it suits, what to check, official link.
- Regional roundup: compare three to five programs by distance, timing, cost,
  and audience; avoid thin lists.
- Evergreen guide: teach users how to search, compare, apply, or prepare.
- Deadline guide: only when the deadline is still actionable and the status was
  rechecked immediately before publication.

Every article must add a useful decision layer beyond the source notice. It
should answer what the program is, who it suits, what could prevent a good fit,
what to verify, and what the reader can do next.

## Quality and copyright gates

- Recheck dynamic facts immediately before publication.
- Include a unique title, description, canonical URL, publication/modified
  dates, author, source checked date, and official link.
- Include BlogPosting and BreadcrumbList structured data.
- Keep all published URLs in sitemap.xml and full article text in the RSS feed.
- Never copy the source notice's paragraphs or lightly rearrange them.
- Use program facts only as facts; write analysis and checklists from scratch.
- Use owned brand art by default. Use external posters or photos only when the
  reuse license is explicit and attribution is displayed.
- Do not keyword-stuff, backdate, change dates without substantial edits, or
  mass-publish unreviewed AI drafts.
- Expired posts should be refreshed with a clear ended state and links to live
  alternatives. Do not silently delete useful URLs.

## Approval-stage automation design

After sample approval, implement a draft-first pipeline:

1. Read current candidates from the existing public read-only program surface.
2. Score and select one candidate using the schedule and regional mix above.
3. Recheck status, dates, official URL, and image rights.
4. Generate an original draft plus metadata and internal links.
5. Reject drafts that fail factual, duplication, copyright, or readability
   checks.
6. During the first two weeks, create a review queue instead of auto-publishing.
7. After editorial acceptance is stable, publish at 08:30 KST and update the
   sitemap and RSS feed.
8. Notify search engines only after the owner completes site verification and
   approves the submission credentials.

No database writes, cron changes, IndexNow key, or search-console connection is
part of the launch-sample implementation.

## Measurement

Track by article and by category/region:

- Search impressions and click-through rate.
- Indexed URL count and crawl errors.
- Blog-to-program-detail clicks.
- Blog-to-map clicks.
- Official application-link clicks.
- Freshness errors, broken links, and corrected facts.
- Search citations or referred visits from AI answer products where the
  webmaster platform exposes them.

## Search, answer, and AI citation design

- Titles combine genuine intent signals—region, cost where known, program type,
  name, and guide intent—without repeating the same keyword unnaturally.
- Put the direct answer first, then a fact table, original decision guidance,
  visible questions and answers, media with source labels, and a final official
  action link. This lets both people and answer engines identify a citable
  passage without guessing.
- Use canonical URLs, index/follow controls, XML sitemaps, BlogPosting,
  BreadcrumbList, FAQPage, and Event only when actual event dates exist.
- Keep important facts in visible text; images supplement rather than replace
  the program name, place, dates, cost, audience, and status.
- Monitor Google Search Console, Naver Search Advisor, and Bing Webmaster Tools
  after ownership verification. Use their indexing and citation reports to
  improve factual clarity and internal linking, never to manufacture keyword
  variations.
- No technical markup guarantees a citation. The defensible strategy is a
  crawlable page with stable identity, original useful context, precise source
  attribution, current status, and corrections over time.

Review weekly for six weeks. Keep the cadence stable while learning; change one
variable at a time, such as title structure, category mix, or regional mix.
