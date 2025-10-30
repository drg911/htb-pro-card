# HTB Pro Card [**WIP**]
### An easy way to integrate your _Hack The Box_ Profile to your wordpress site


[![Build](https://img.shields.io/github/v/release/drg911/htb-wp-integration?include_prereleases&display_name=release&label=build)](https://github.com/drg911/htb-wp-integration/releases)
 
[![License](https://img.shields.io/github/license/drg911/htb-wp-integration)](https://github.com/drg911/htb-wp-integration/blob/main/LICENSE)  

## Description  
HTB WP Integration is a plugin/tool that connects the HackTheBox (HTB) platform with a WordPress site, enabling seamless integration of HTB elements within your WP environment.  

## Features  
- Automatically fetches HTB data and displays within WordPress.  
- Shortcodes or blocks for embedding HTB challenges or user stats.  
- Simple configuration via WP Admin settings page.  
- Lightweight and built for ease of deployment in security-tooling or pentest-lab setups.  
- (Future) Support for custom widgets, REST endpoints, and HTB API features.  

## Requirements  
- WordPress 5.0+  
- PHP 7.4 or higher  
- HTB account (for API/token access)  
- The plugin requires that your WordPress site is able to communicate externally (cURL/OpenSSL)  

## Installation 

### Git:
1. Clone or download the repository to your WordPress `wp-content/plugins/` directory  
   ```bash  
   git clone https://github.com/drg911/htb-wp-integration.git
### Wordpress: 
1. Download the latest [release](https://github.com/drg911/htb-wp-integration/releases)

2. in your Wordpress dashboard, navigate to _Plugins_ > _Add Pugin_

![alt text](image-1.png)

3. Select _Upload Plugin_ (Towards the top of the page)

![alt text](image.png)

4. Upload the _htb-pro-card.zip_ and select _Install Now_

![alt text](image-2.png)


## Activation
1. In the WP Admin dashboard go to Plugins → Installed Plugins and activate “HTB WP Integration”.

2. Navigate to Settings → HTB WP Integration and enter your HTB API token (or other credentials) and configure the display settings.

3. Select _Run Test_ to test the connection to HTB Servers.

![alt text](image-3.png)

Optionally style the output via your theme’s CSS or override templates as needed.

## Usage Example

**WIP**

## License

This project is licensed under the MIT License — see the LICENSE file for details.

## Credits
Developed by [@drg911](https://github.com/drg911)

Thanks to the HTB community and WordPress plugin ecosystem for inspiration.