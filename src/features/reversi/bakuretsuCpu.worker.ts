import {
  runBakuretsuCpuRequest,
  type BakuretsuCpuRequest,
  type BakuretsuCpuResponse,
} from './bakuretsuCpu';

type CpuWorkerScope = {
  onmessage: ((event: MessageEvent<BakuretsuCpuRequest>) => void) | null;
  postMessage: (response: BakuretsuCpuResponse) => void;
};

const workerScope = self as unknown as CpuWorkerScope;

workerScope.onmessage = (event) => {
  workerScope.postMessage(runBakuretsuCpuRequest(event.data));
};
