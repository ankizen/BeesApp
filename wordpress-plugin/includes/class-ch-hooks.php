<?php

if (!defined('ABSPATH')) {
    exit;
}

class CH_Connector_Hooks
{
    public function __construct()
    {
        add_action('transition_post_status', [$this, 'on_status_transition'], 10, 3);
        add_filter('post_row_actions', [$this, 'add_row_action'], 10, 2);
        add_action('admin_post_ch_connector_resend', [$this, 'handle_resend']);
    }

    // Fires the webhook the moment a post first becomes (or is re-saved as) published.
    public function on_status_transition(string $new_status, string $old_status, WP_Post $post): void
    {
        if ($post->post_type !== 'post') {
            return;
        }
        if ($new_status !== 'publish') {
            return;
        }
        CH_Connector_Webhook_Sender::send($post->ID);
    }

    public function add_row_action(array $actions, WP_Post $post): array
    {
        if ($post->post_status !== 'publish' || $post->post_type !== 'post') {
            return $actions;
        }

        $url = wp_nonce_url(
            admin_url('admin-post.php?action=ch_connector_resend&post=' . $post->ID),
            'ch_connector_resend_' . $post->ID
        );

        $status = get_post_meta($post->ID, '_ch_connector_last_status', true);
        $label = $status === 'failed' ? 'Resend to Content Hub (last attempt failed)' : 'Resend to Content Hub';

        $actions['ch_connector_resend'] = '<a href="' . esc_url($url) . '">' . esc_html($label) . '</a>';
        return $actions;
    }

    public function handle_resend(): void
    {
        $post_id = isset($_GET['post']) ? (int) $_GET['post'] : 0;
        check_admin_referer('ch_connector_resend_' . $post_id);

        if (!current_user_can('edit_post', $post_id)) {
            wp_die('Not allowed.');
        }

        $result = CH_Connector_Webhook_Sender::send($post_id);
        $notice = is_wp_error($result) ? 'ch_resend_failed' : 'ch_resend_ok';

        wp_safe_redirect(add_query_arg('ch_notice', $notice, wp_get_referer() ?: admin_url('edit.php')));
        exit;
    }
}
