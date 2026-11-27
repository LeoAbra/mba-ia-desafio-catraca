import type { NextFunction, Request, Response } from 'express';
import { html } from '../../shared/html.js';
import { layout } from '../../shared/layout.js';
import type { Role } from '../../shared/types.js';

const FORBIDDEN_TEXT: Record<Role, string> = {
  organizer: 'Acesso restrito a organizadores',
  participant: 'Acesso restrito a participantes',
};

function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.redirect(302, `/entrar?next=${encodeURIComponent(req.originalUrl)}`);
      return;
    }
    if (req.user.role !== role) {
      res.status(403).send(layout('Acesso negado', req.user, html`<p>${FORBIDDEN_TEXT[role]}.</p>`));
      return;
    }
    next();
  };
}

/** Área do organizador: visitante vai ao login, participante recebe 403 (R13). */
export const requireOrganizer = requireRole('organizer');
/** Ações de participante (comprar, meus ingressos). */
export const requireParticipant = requireRole('participant');
