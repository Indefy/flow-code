export function requireContent(req, res, next) {
  if (!req.body.content || typeof req.body.content !== 'string') {
    return res.status(400).json({ error: 'Message content is required' });
  }
  next();
}

export function requireMessage(req, res, next) {
  if (!req.body.message || typeof req.body.message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }
  next();
}
