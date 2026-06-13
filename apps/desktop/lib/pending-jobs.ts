import "server-only";
import fs from "fs";
import path from "path";

interface PendingJob {
  jobId: string;
  folderName: string;
  addedAt: number;
}

const STORE_PATH = path.join(process.cwd(), ".pending-jobs.json");

function load(): PendingJob[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
    }
  } catch {}
  return [];
}

function save(jobs: PendingJob[]) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(jobs, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not save pending jobs:", err);
  }
}

export const PendingJobs = {
  add(jobId: string, folderName: string) {
    const jobs = load();
    if (!jobs.find((j) => j.jobId === jobId)) {
      jobs.push({ jobId, folderName, addedAt: Date.now() });
      save(jobs);
    }
  },

  remove(jobId: string) {
    const jobs = load().filter((j) => j.jobId !== jobId);
    save(jobs);
  },

  getAll(): PendingJob[] {
    return load();
  },
};