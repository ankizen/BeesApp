<?php
/**
 * Plugin Name: Content Hub Connector
 * Description: Sends newly published articles to a self-hosted Content Hub instance for distribution to social media.
 * Version: 1.0.0
 * Author: Content Hub
 * License: GPL-2.0-or-later
 * Text Domain: content-hub-connector
 */

if (!defined('ABSPATH')) {
    exit;
}

define('CH_CONNECTOR_VERSION', '1.0.0');
define('CH_CONNECTOR_DIR', plugin_dir_path(__FILE__));

require_once CH_CONNECTOR_DIR . 'includes/class-ch-webhook-sender.php';
require_once CH_CONNECTOR_DIR . 'includes/class-ch-hooks.php';
require_once CH_CONNECTOR_DIR . 'includes/class-ch-admin.php';

register_activation_hook(__FILE__, function () {
    add_option('ch_connector_webhook_url', '');
    add_option('ch_connector_webhook_secret', '');
});

add_action('plugins_loaded', function () {
    new CH_Connector_Hooks();
    if (is_admin()) {
        new CH_Connector_Admin();
    }
});
