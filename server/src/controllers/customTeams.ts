import {Request, Response} from 'express';

import {readCustomTeams, writeCustomTeams, generateSlug} from '../file/customTeams';
import {TeamInfo} from '../types/types';

export function getCustomTeams(_req: Request, res: Response): void {
  const teams = readCustomTeams();
  res.json(teams);
}

export function createCustomTeam(req: Request, res: Response): void {
  const {name, memberLogins} = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({error: 'Name is required'});
    return;
  }

  if (!Array.isArray(memberLogins)) {
    res.status(400).json({error: 'memberLogins must be an array'});
    return;
  }

  const teams = readCustomTeams();

  const nameExists = teams.some((t) => t.name.toLowerCase() === name.trim().toLowerCase());
  if (nameExists) {
    res.status(400).json({error: 'A custom team with this name already exists'});
    return;
  }

  const existingSlugs = teams.map((t) => t.slug);
  const slug = generateSlug(name.trim(), existingSlugs);

  const newTeam: TeamInfo = {
    slug,
    name: name.trim(),
    memberLogins,
    source: 'custom',
  };

  teams.push(newTeam);
  writeCustomTeams(teams);

  res.status(201).json(newTeam);
}

export function updateCustomTeam(req: Request, res: Response): void {
  const {slug} = req.params;
  const {name, memberLogins} = req.body;

  const teams = readCustomTeams();
  const index = teams.findIndex((t) => t.slug === slug);

  if (index === -1) {
    res.status(404).json({error: 'Custom team not found'});
    return;
  }

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({error: 'Name must be a non-empty string'});
      return;
    }

    const nameExists = teams.some(
      (t, i) => i !== index && t.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (nameExists) {
      res.status(400).json({error: 'A custom team with this name already exists'});
      return;
    }
  }

  if (memberLogins !== undefined && !Array.isArray(memberLogins)) {
    res.status(400).json({error: 'memberLogins must be an array'});
    return;
  }

  const updated: TeamInfo = {
    slug: teams[index].slug,
    name: name !== undefined ? name.trim() : teams[index].name,
    memberLogins: memberLogins !== undefined ? memberLogins : teams[index].memberLogins,
    source: 'custom',
  };

  teams[index] = updated;
  writeCustomTeams(teams);

  res.json(updated);
}

export function deleteCustomTeam(req: Request, res: Response): void {
  const {slug} = req.params;

  const teams = readCustomTeams();
  const index = teams.findIndex((t) => t.slug === slug);

  if (index === -1) {
    res.status(404).json({error: 'Custom team not found'});
    return;
  }

  teams.splice(index, 1);
  writeCustomTeams(teams);

  res.status(204).send();
}
