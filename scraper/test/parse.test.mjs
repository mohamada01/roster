import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSite } from '../site.mjs';
import { normalize, parseCount, isProfileLink, handleOf } from '../lib.mjs';
import { parseInstagramJson, parseMetaFollowers, parseTikTok, parseYouTube } from '../platforms.mjs';
import { parseSortlist } from '../sortlist.mjs';
import { classifyByKeywords } from '../classify.mjs';

const MULLERS = `<html><head><title>Müller's - Digital and Creative Marketing Agency</title>
<meta name="description" content="Full-service creative agency in Cairo, Riyadh &amp; Dubai. Müller's delivers TV production, social media, PR, branding, media buying &amp; AI-powered content.">
<meta property="og:site_name" content="Müller's">
<link rel="icon" href="/fav-32.png" sizes="32x32"><link rel="apple-touch-icon" href="/apple.png">
</head><body><p>Founded in 2006 by 2 marketers.</p>
<footer><a href="https://www.instagram.com/mullersmena/">Instagram</a>
<a href="https://www.linkedin.com/company/m%C3%BCllers-communications/">LinkedIn</a>
<a href="https://www.facebook.com/Mullersnetwork/">Facebook</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=x">share</a></footer></body></html>`;

test('parses a real-shaped agency homepage', () => {
  const s = parseSite(MULLERS, 'https://muller-mena.com/');
  assert.equal(s.name, "Müller's");
  assert.equal(s.description, "Full-service creative agency in Cairo, Riyadh & Dubai. Müller's delivers TV production, social media, PR, branding, media buying & AI-powered content.");
  assert.equal(s.descriptionSource, 'meta description');
  assert.equal(s.logo, 'https://muller-mena.com/apple.png');
  assert.equal(s.links.instagram, 'https://www.instagram.com/mullersmena/');
  assert.equal(s.links.facebook, 'https://www.facebook.com/Mullersnetwork/');
  assert.ok(s.links.linkedin.includes('/company/'));
  assert.deepEqual(s.countries.sort(), ['AE', 'EG', 'SA']);
  assert.equal(s.founded, 2006);
});

test('client countries in the body do not leak into countries', () => {
  const s = parseSite('<html><head><meta name="description" content="Agency in London and Cairo."></head><body><h2>Clients</h2><p>Australia China Germany Qatar</p></body></html>', 'https://x.com/');
  assert.deepEqual(s.countries.sort(), ['EG', 'GB']);
});

test('normalises links for duplicate detection', () => {
  assert.equal(normalize('https://www.muller-mena.com/about').key, 'muller-mena.com');
  assert.equal(normalize('muller-mena.com').key, 'muller-mena.com');
  assert.equal(normalize('https://www.instagram.com/MullersMena/').key, 'instagram.com/mullersmena');
  assert.equal(normalize('instagram.com/mullersmena').kind, 'instagram');
  assert.ok(normalize('foo').bad);
});

test('recognises profile links and handles', () => {
  assert.ok(isProfileLink('https://www.tiktok.com/@brand'));
  assert.ok(!isProfileLink('https://www.instagram.com/p/abc123/'));
  assert.ok(!isProfileLink('https://twitter.com/intent/tweet?text=x'));
  assert.ok(isProfileLink('https://www.youtube.com/@brand'));
  assert.ok(!isProfileLink('https://www.youtube.com/watch?v=1'));
  assert.equal(handleOf('https://www.linkedin.com/company/stork-advertising/'), 'stork-advertising');
  assert.equal(handleOf('https://www.instagram.com/blabla.studio'), 'blabla.studio');
});

test('parses counts', () => {
  assert.equal(parseCount('12.3K'), 12300);
  assert.equal(parseCount('1,204'), 1204);
  assert.equal(parseCount('2.1M'), 2100000);
  assert.equal(parseCount('8,900'), 8900);
  assert.equal(parseInstagramJson('{"data":{"user":{"edge_followed_by":{"count":48211},"external_url":"https://muller-mena.com"}}}').count, 48211);
  assert.equal(parseMetaFollowers('<meta content="12K Followers, 300 Following">'), 12000);
  assert.equal(parseMetaFollowers('Stork Advertising | 8,900 followers on LinkedIn'), 8900);
  assert.equal(parseTikTok('..."stats":{"followerCount":204001,"followingCount":3}'), 204001);
  assert.equal(parseYouTube('"subscriberCountText":{"accessibility":{},"simpleText":"41.2K subscribers"}'), 41200);
});

test('parses Sortlist rating', () => {
  const html = '<script type="application/ld+json">{"@type":"Organization","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.9","reviewCount":31}}</script>';
  assert.deepEqual(parseSortlist(html), { rating: 4.9, reviews: 31 });
});

test('classifies from site text', () => {
  assert.equal(classifyByKeywords("Full-service creative agency in Cairo, Riyadh & Dubai. Müller's delivers TV production, social media, PR, branding, media buying & AI-powered content.", ''), 'creative');
  assert.equal(classifyByKeywords('Stork Advertising is a performance-led digital marketing agency in London, Dubai & Cairo. Social media, GEO, video & web dev that drive measurable ROI.', ''), 'performance');
  assert.equal(classifyByKeywords('Independent branding studio building brand identity and packaging.', ''), 'branding');
  assert.equal(classifyByKeywords('', ''), 'none');
});

import { servicesFromPage, aboutFromPage } from '../site.mjs';

const OGBEES = `<html><head><title>OG Bees</title></head><body>
<nav><a href="/">Home</a><a href="/about-us">About</a><a href="/our-work">Work</a></nav>
<h2>UGC Ads That Deliver More Clicks, Lower Costs, &amp; Real Results!</h2>
<p>Your products deserve the spotlight! The right UGC strategy boosts your brand, drives conversions, and builds trust!</p>
<section><h3>Packages &amp; Services</h3><div><h4>UGC Video Ads</h4><h4>Product Photography</h4><h4>Creator Matching</h4><a>Get started</a></div></section>
<footer><a href="mailto:support@ogbees.com">Email</a><a href="https://ogbees.com/instagram">IG</a><a href="https://ogbees.com/linkedin">in</a>
<a href="https://www.facebook.com/groups/1097866811408456">group</a>
<a href="https://api.whatsapp.com/send/?phone=%2B201274632470&type=phone_number">WhatsApp</a></footer></body></html>`;

test('site without meta description: lead text, internal social links, contact, services', () => {
  const s = parseSite(OGBEES, 'https://ogbees.com/');
  assert.equal(s.description, null);
  assert.equal(s.heroText, 'UGC Ads That Deliver More Clicks, Lower Costs, & Real Results! Your products deserve the spotlight! The right UGC strategy boosts your brand, drives conversions, and builds trust!');
  assert.equal(s.internalSocial.instagram, 'https://ogbees.com/instagram');
  assert.equal(s.internalSocial.linkedin, 'https://ogbees.com/linkedin');
  assert.equal(s.links.facebook, undefined, 'facebook groups are not company profiles');
  assert.deepEqual(s.contact.emails, ['support@ogbees.com']);
  assert.equal(s.contact.whatsapp, '+201274632470');
  assert.deepEqual(s.countries, ['EG']);
  assert.equal(s.aboutUrl, 'https://ogbees.com/about-us');
  assert.deepEqual(s.services, ['UGC Video Ads', 'Product Photography', 'Creator Matching']);
});

test('services page and about page extraction', () => {
  const svc = servicesFromPage('<main><h1>Our Services</h1><h2>Brand Strategy</h2><p>x</p><h2>Social Media Management</h2><h2>Video Production</h2><h2>Contact</h2><h2>Why choose us?</h2></main>');
  assert.deepEqual(svc, ['Brand Strategy', 'Social Media Management', 'Video Production']);
  const about = aboutFromPage('<main><p>Short.</p><p>We are a creative studio founded in Cairo that helps ambitious brands tell clearer stories across every channel.</p></main><footer><p>© 2026 All rights reserved and some more words to pass the length check here.</p></footer>');
  assert.equal(about, 'We are a creative studio founded in Cairo that helps ambitious brands tell clearer stories across every channel.');
});

test('services ignore forms, menus and questions', () => {
  const html = `<html><body><header><nav><a href="/about-us">About Us</a><a href="/use-cases">Use Cases</a></nav></header>
  <section><h2>Our Services</h2><div><h3>Digital problems?Storky eat them for breakfast</h3><h4>Social Media Marketing</h4><h4>Video Production</h4><h4>Use Cases</h4><h4>Website Development</h4></div></section>
  <form><h2>Services needed</h2><h3>Let's build something</h3><h3>Your business</h3><h3>Tell us more</h3></form></body></html>`;
  const s = parseSite(html, 'https://x.com/');
  assert.deepEqual(s.services, ['Social Media Marketing', 'Video Production', 'Website Development']);
});
