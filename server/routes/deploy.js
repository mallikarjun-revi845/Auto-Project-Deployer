const express = require('express');
const { requireAuth } = require('../middleware/auth');
const controller = require('../controllers/deployController');

const router = express.Router();

router.use(requireAuth);

router.post('/', controller.createDeploymentRequest);
router.post('/analyze', controller.analyzeRepository);
router.get('/history', controller.listDeployments);
router.get('/:id', controller.getDeploymentById);

module.exports = router;
