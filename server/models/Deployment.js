const mongoose = require('mongoose');

const DEPLOYMENT_STATUSES = [
  'queued',
  'validating',
  'detecting',
  'checking',
  'cloning',
  'building',
  'deploying',
  'verifying',
  'live',
  'failed',
  'unsupported',
];

const deploymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    repoUrl: { type: String, required: true },
    projectName: { type: String, required: true },
    projectType: { type: String, default: 'unknown' },
    platform: { type: String, default: 'vercel' },
    status: { type: String, enum: DEPLOYMENT_STATUSES, default: 'queued', index: true },
    liveUrl: { type: String, default: '' },
    vercelDeploymentId: { type: String, default: '' },
    errorMessage: { type: String, default: '' },
    logs: [
      {
        step: String,
        message: String,
        at: { type: Date, default: Date.now },
      },
    ],
    deployDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Deployment', deploymentSchema);
module.exports.DEPLOYMENT_STATUSES = DEPLOYMENT_STATUSES;
