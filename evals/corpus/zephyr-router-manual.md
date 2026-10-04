# Zephyr R9 Router Manual

> Eval-only fixture: a made-up product manual used by `make eval`. Nothing in it is real, so a correct answer can only come from retrieval, never from a model's memory. It is not part of the live library.

The Zephyr R9 is a dual-band wireless router. This manual covers setup, the status lights, error codes and firmware.

## Setup

Plug in the power adapter and connect the blue port to your modem. The R9 starts in about 90 seconds. Open a browser and go to the default address 10.7.7.1 to reach the admin page. The default admin password is printed on the label under the router.

## Status lights

A steady white light means the router is online. A slow pulsing amber light means it cannot reach the internet. A fast flashing red light means a hardware fault; unplug the router for 30 seconds and try again.

## Error codes

Error code E-4417 means the WAN link negotiated at the wrong speed; replace the cable between the router and the modem. Error code E-2093 means the DHCP server ran out of addresses; reduce the lease time to 8 hours. Error code E-7701 means the firmware update was interrupted; hold the reset button while powering on to start recovery mode.

## Factory reset

To restore factory settings, hold the reset button for 13 seconds until the light flashes violet. All saved passwords and port forwards are erased.

## Firmware

Version 2.4.0 was the first public release. Version 2.6.3 added guest networks. Version 2.8.1 added WPA3 support and fixed the interrupted-update bug behind error E-7701. Update from the admin page under System, then Firmware.
