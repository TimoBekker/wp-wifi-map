<?php
/*
Plugin Name: WiFi Map
Description: Публичные точки доступа WiFi СО
Version: 1.2.0
Author: Timo Bekker
*/

if (!defined('ABSPATH')) exit;

function wifi_map_wp_enqueue_assets() {
    wp_enqueue_style('wp-wifi-map-style', plugins_url('/assets/style.css', __FILE__ ));
    wp_enqueue_script('yandex-maps', "https://api-maps.yandex.ru/2.1/?lang=ru_RU", [], null, true);
    wp_enqueue_script('wp-wifi-map-script', plugins_url('assets/script.js', __FILE__ ), ['yandex-maps'], null, true);

    wp_localize_script('wp-wifi-map-script', 'wifiMapData', [
        'addressRT' => plugins_url('data/address_rt.json', __FILE__),
        'addressDR' => plugins_url('data/address_dr.json', __FILE__),
        'addressDT' => plugins_url('data/address_dt.json', __FILE__),
    ]);
}
add_action('wp_enqueue_scripts', 'wifi_map_wp_enqueue_assets');

function wp_wifi_map_shortcode() {
    ob_start();
    ?>
    <div class="wifi-map-wp-wrapper">
        <div class="wifi-map-wp-container">
            <div id="map"></div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('wifi_map', 'wp_wifi_map_shortcode');