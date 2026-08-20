<?php

if (!defined('ABSPATH')) {
    exit;
}

class CH_Connector_Admin
{
    public function __construct()
    {
        add_action('admin_menu', [$this, 'add_settings_page']);
        add_action('admin_init', [$this, 'register_settings']);
        add_action('admin_notices', [$this, 'render_notices']);
        add_action('wp_ajax_ch_connector_test_connection', [$this, 'ajax_test_connection']);
        add_action('wp_ajax_ch_connector_resync', [$this, 'ajax_resync']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_assets']);
    }

    public function add_settings_page(): void
    {
        add_options_page(
            'Content Hub Connector',
            'Content Hub',
            'manage_options',
            'ch-connector',
            [$this, 'render_settings_page']
        );
    }

    public function register_settings(): void
    {
        register_setting('ch_connector', 'ch_connector_webhook_url', ['sanitize_callback' => 'esc_url_raw']);
        register_setting('ch_connector', 'ch_connector_webhook_secret', ['sanitize_callback' => 'sanitize_text_field']);
    }

    public function enqueue_assets(string $hook): void
    {
        if ($hook !== 'settings_page_ch-connector') {
            return;
        }
        wp_enqueue_script(
            'ch-connector-admin',
            plugins_url('../assets/admin.js', __FILE__),
            ['jquery'],
            CH_CONNECTOR_VERSION,
            true
        );
        wp_localize_script('ch-connector-admin', 'chConnector', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('ch_connector_ajax'),
        ]);
    }

    public function render_settings_page(): void
    {
        ?>
        <div class="wrap">
            <h1>Content Hub Connector</h1>
            <p>Paste the Webhook URL and Webhook Secret shown when you added this site in Content Hub.</p>
            <form method="post" action="options.php">
                <?php settings_fields('ch_connector'); ?>
                <table class="form-table">
                    <tr>
                        <th><label for="ch_connector_webhook_url">Webhook URL</label></th>
                        <td>
                            <input type="url" id="ch_connector_webhook_url" name="ch_connector_webhook_url"
                                   class="regular-text" required
                                   value="<?php echo esc_attr(get_option('ch_connector_webhook_url')); ?>"
                                   placeholder="https://api.yourdomain.com/api/webhooks/wordpress/&lt;site-id&gt;">
                        </td>
                    </tr>
                    <tr>
                        <th><label for="ch_connector_webhook_secret">Webhook Secret</label></th>
                        <td>
                            <input type="password" id="ch_connector_webhook_secret" name="ch_connector_webhook_secret"
                                   class="regular-text" required
                                   value="<?php echo esc_attr(get_option('ch_connector_webhook_secret')); ?>">
                        </td>
                    </tr>
                </table>
                <?php submit_button('Save Settings'); ?>
            </form>

            <hr>
            <h2>Connection</h2>
            <p>
                <button type="button" class="button" id="ch-connector-test">Test Connection</button>
                <span id="ch-connector-test-result"></span>
            </p>

            <h2>Manual Re-sync</h2>
            <p>Resends your most recently published articles to Content Hub (useful after connecting for the first time, or recovering from downtime).</p>
            <p>
                <label>
                    Number of recent articles:
                    <input type="number" id="ch-connector-resync-count" value="20" min="1" max="200" style="width:70px">
                </label>
                <button type="button" class="button button-primary" id="ch-connector-resync">Re-sync Now</button>
                <span id="ch-connector-resync-result"></span>
            </p>
        </div>
        <?php
    }

    public function render_notices(): void
    {
        if (!isset($_GET['ch_notice'])) {
            return;
        }
        if ($_GET['ch_notice'] === 'ch_resend_ok') {
            echo '<div class="notice notice-success is-dismissible"><p>Article resent to Content Hub.</p></div>';
        } elseif ($_GET['ch_notice'] === 'ch_resend_failed') {
            echo '<div class="notice notice-error is-dismissible"><p>Failed to resend article to Content Hub. Check Settings &rarr; Content Hub.</p></div>';
        }
    }

    public function ajax_test_connection(): void
    {
        check_ajax_referer('ch_connector_ajax', 'nonce');
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Not allowed'], 403);
        }

        $webhook_url = get_option('ch_connector_webhook_url');
        $secret = get_option('ch_connector_webhook_secret');
        if (empty($webhook_url) || empty($secret)) {
            wp_send_json_error(['message' => 'Set the webhook URL and secret first.']);
        }

        $ping_url = rtrim($webhook_url, '/') . '/ping';
        $body = '{}';
        $signature = hash_hmac('sha256', $body, $secret);

        $response = wp_remote_post($ping_url, [
            'timeout' => 10,
            'headers' => [
                'Content-Type' => 'application/json',
                'X-Content-Hub-Signature' => 'sha256=' . $signature,
            ],
            'body' => $body,
        ]);

        if (is_wp_error($response)) {
            wp_send_json_error(['message' => $response->get_error_message()]);
        }

        $status = wp_remote_retrieve_response_code($response);
        if ($status >= 200 && $status < 300) {
            wp_send_json_success(['message' => 'Connected successfully.']);
        }
        wp_send_json_error(['message' => "Content Hub responded with HTTP $status. Check the URL and secret."]);
    }

    public function ajax_resync(): void
    {
        check_ajax_referer('ch_connector_ajax', 'nonce');
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Not allowed'], 403);
        }

        $count = isset($_POST['count']) ? max(1, min(200, (int) $_POST['count'])) : 20;

        $posts = get_posts([
            'post_type' => 'post',
            'post_status' => 'publish',
            'numberposts' => $count,
            'orderby' => 'date',
            'order' => 'DESC',
        ]);

        $sent = 0;
        $failed = 0;
        foreach ($posts as $post) {
            $result = CH_Connector_Webhook_Sender::send($post->ID);
            is_wp_error($result) ? $failed++ : $sent++;
        }

        wp_send_json_success(['message' => "Re-sync complete: $sent sent, $failed failed."]);
    }
}
