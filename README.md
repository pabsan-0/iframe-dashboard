# iframe-dashboard

A simple wrapper website to act as common entrypoint to self-hosted applications, with YAML-defined structure.

# Usage

In my setup, using docker helps me organize all my processes, so this app is docker-run. You can also serve it with you favourite http server.

- Tune `services.yaml` to your liking
- Run `docker compose up -d`

Retune `settings.yaml` and reload the page to have changes reflected.

# YAML Syntax

The page is configured through the file `services.yaml`. Find commited a real world example on how it may look.
There's two sections in this file which we'll now describe.

## Services

Here is where you actually add your apps. They must be placed within a group, and you 
can call both the group and the app whatever you want.
  
```
services:
  MyGroupAlias:
    MyServiceAlias:
      - host: false       # No host means use the server's
      - port: 8096        # Port where service is hosted
      - newtab: false     # Preview in webpage, or force in new tab
      - icon: https://... # Link to icon
    
```

## Host resolution

In this dashboard, you will be connecting from your client (known IP) to your 
self-hosted server, which may have different addresses based on the network you are 
(home, VPN...). Hence, services on your server may have different IPs to the eyes of your client.

These mappings are used to find your host's IP based on your client IP. The
app looks for a match in the specified order then fallbacks to localhost.
```
host-resolution:
  - 10.8.*.*: 10.8.0.3          # Subnet -> Server IP candidate 1
  - 192.168.*.*: 192.168.0.254  # Subnet -> Server IP candidate 2
```

## Real world YAML example

```
# If I connect from 10.144.0.0 the host is at 10.144.23.42
# If I connect from 192.168.0.0 the host is at 192.168.11.120
host-resolution:
  - 10.144.*.*: 10.144.23.42
  - 192.168.*.*: 192.168.11.120

services:
  Media:
    # This is a jellyfin service
    # No host is specified so it will use the server's address 
    jellyfin:
      - port: 8096
      - icon: https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/jellyfin.png
    
    # This is an example thirdparty website 
    yams-docs:
      - host: https://yams.media/
      - icon: https://yams.media/pics/logo.webp 
      
  Infra:
    # Portainer cannot be opened within an iframe without passing some extra config
    # so we just have it open on a new tab.
    portainer:
      - port: 9000
      - icon: https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/portainer.png
      - newtab: true
```
