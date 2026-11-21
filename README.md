# Deep Blue Rescue

An underwater rescue game made with Babylon.js as a team project for BBM 412 Computer Graphics at
Hacettepe University, with custom water and seashell shaders, animated fish and Recast navigation.

Play it at https://deepbluerescuegame.onrender.com. The free server sleeps when idle, so the first
load can take a minute.

This repository holds the build that is deployed there.

## How to play

The game needs a mouse and keyboard, so it does not work on phones.

- Swim with W, A, S and D. Hold the left mouse button and drag to look around.
- Find trash on the seabed; it glows when your cursor is on it. Press the mouse wheel on it to send
  the robot to collect it.
- Left-click a fish to catch it and pull the plastic bag out of its mouth.
- Q and E tilt the view, O levels it. You have 90 seconds.
- Once the game opens, turn the light intensity up to the maximum in the panel on the right.

## Run locally

```
npm install
npm run dev
```
