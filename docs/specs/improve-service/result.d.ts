// Additive result projection for the original REQ-SERVICE-17 canonical report.
// Request types remain strict and unchanged. Countdown may decrease without changing factual revision.
import type {Job} from './interface';
import type {MorningReportV2} from '../improve-recovery/interface';
export interface StatusResult {
  api_version:1;
  jobs:Job[];
  reports:Array<MorningReportV2 & {stage:string;last_completed_action:string}>;
}
