<?php

if (!defined('ABSPATH')) {
    exit;
}

class CH_Connector_Webhook_Sender
{
    /**
     * Builds the webhook payload for a post and sends it to Content Hub.
     * Returns true on 2xx, or a WP_Error / string message on failure.
     */
    public static function send(int $post_id)
    {
        $webhook_url = get_option('ch_connector_webhook_url');
        $secret = get_option('ch_connector_webhook_secret');

        if (empty($webhook_url) || empty($secret)) {
            return new WP_Error('ch_not_configured', 'Content Hub webhook URL/secret is not configured.');
        }

        $post = get_post($post_id);
        if (!$post || $post->post_status !== 'publish') {
            return new WP_Error('ch_not_published', 'Post is not published.');
        }

        $payload = self::build_payload($post);
        $body = wp_json_encode($payload);
        $signature = hash_hmac('sha256', $body, $secret);

        $response = wp_remote_post($webhook_url, [
            'timeout' => 15,
            'headers' => [
                'Content-Type' => 'application/json',
                'X-Content-Hub-Signature' => 'sha256=' . $signature,
            ],
            'body' => $body,
        ]);

        if (is_wp_error($response)) {
            self::record_result($post_id, false, $response->get_error_message());
            return $response;
        }

        $status = wp_remote_retrieve_response_code($response);
        if ($status >= 200 && $status < 300) {
            self::record_result($post_id, true, "HTTP $status");
            return true;
        }

        $message = "HTTP $status: " . wp_remote_retrieve_body($response);
        self::record_result($post_id, false, $message);
        return new WP_Error('ch_send_failed', $message);
    }

    public static function build_payload(WP_Post $post): array
    {
        $categories = wp_get_post_categories($post->ID, ['fields' => 'names']);
        $tags = wp_get_post_tags($post->ID, ['fields' => 'names']);
        $thumbnail_id = get_post_thumbnail_id($post->ID);

        return [
            'postId' => $post->ID,
            'title' => get_the_title($post),
            'url' => get_permalink($post),
            'featuredImage' => $thumbnail_id ? wp_get_attachment_image_url($thumbnail_id, 'full') : null,
            'excerpt' => self::get_excerpt($post),
            'publishedDate' => get_the_date('c', $post),
            'categories' => array_values($categories),
            'tags' => array_values($tags),
        ];
    }

    private static function get_excerpt(WP_Post $post): string
    {
        if (!empty($post->post_excerpt)) {
            return wp_strip_all_tags($post->post_excerpt);
        }
        return wp_trim_words(wp_strip_all_tags($post->post_content), 55);
    }

    private static function record_result(int $post_id, bool $success, string $message): void
    {
        update_post_meta($post_id, '_ch_connector_last_status', $success ? 'success' : 'failed');
        update_post_meta($post_id, '_ch_connector_last_message', $message);
        update_post_meta($post_id, '_ch_connector_last_sent_at', current_time('mysql'));
    }
}
