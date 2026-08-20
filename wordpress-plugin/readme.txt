=== Content Hub Connector ===
Contributors: content-hub
Tags: webhook, social media, automation
Requires at least: 5.6
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later

Sends newly published posts to a self-hosted Content Hub instance for distribution to Facebook, Threads, and Mastodon.

== Description ==

1. In Content Hub, add this WordPress site (you'll need a WordPress Application Password: Users -> Profile -> Application Passwords).
2. Content Hub will show you a Webhook URL and Webhook Secret - copy both.
3. In WordPress, go to Settings -> Content Hub and paste them in.
4. Click "Test Connection" to confirm.
5. Publish a post - it's sent automatically. Use "Re-sync Now" to backfill existing posts, or the "Resend to Content Hub" row action on any post to retry a single one.

== Changelog ==

= 1.0.0 =
* Initial release.
