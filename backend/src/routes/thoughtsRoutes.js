import express from 'express';
import { getThoughts, postThought } from '../controllers/thoughtsController.js';

const router = express.Router();

router.get('/', getThoughts);
router.post('/', postThought);

export default router;
