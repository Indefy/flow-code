import express from 'express';
import { postOllama } from '../controllers/ollamaController.js';

const router = express.Router();

router.post('/', postOllama);

export default router;
