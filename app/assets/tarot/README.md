# Tarot Assets

This folder contains the 78 tarot card images used by Wansui V2.0.

## Structure

- `cards/`: normalized PNG card images.
- `cards.json`: card metadata and image paths for app rendering.

## Naming

Major arcana:

- `major-00-fool.png`
- `major-01-magician.png`
- ...
- `major-21-world.png`

Minor arcana:

- `wands-01-ace.png` through `wands-14-king.png`
- `cups-01-ace.png` through `cups-14-king.png`
- `swords-01-ace.png` through `swords-14-king.png`
- `pentacles-01-ace.png` through `pentacles-14-king.png`

Use `cards.json` as the source of truth when matching a card to its image.
