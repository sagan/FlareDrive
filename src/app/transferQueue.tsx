import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { v4 as uuidv4 } from 'uuid'
import { processTransferTask } from "./transfer";
import { useConfig } from "../commons";

/**
 * "Upload aborted" error.
 */
const ERR_ABORT = new Error("Upload aborted")

export interface TransferTask {
  /**
   * task uuid. generated when new task created.
   */
  id: string;
  status: "pending" | "in-progress" | "completed" | "failed" | "canceled";
  remoteKey: string;
  file?: File;
  name: string;
  loaded: number;
  total: number;
  error?: any;
}

const TransferQueueContext = createContext<TransferTask[]>([]);
const SetTransferQueueContext = createContext<
  React.Dispatch<React.SetStateAction<TransferTask[]>>
>(() => { });
const TransferAbortControllerContext = createContext<AbortController>(new AbortController)
const SetTransferAbortControllerContext = createContext<React.Dispatch<React.SetStateAction<AbortController>>>(
  () => { })

export function useTransferQueue(): [tasks: TransferTask[],
  setTasks: React.Dispatch<React.SetStateAction<TransferTask[]>>, cancelTasks: (all?: boolean) => void] {
  const abortController = useContext(TransferAbortControllerContext)
  const setAbortController = useContext(SetTransferAbortControllerContext)
  const tasks = useContext(TransferQueueContext)
  const setTasks = useContext(SetTransferQueueContext)
  const cancelTasks = useMemo(() => (all?: boolean) => {
    if (all) {
      setTasks(tasks => tasks.map(task => task.status == "pending" ?
        { ...task, status: "canceled" } as TransferTask : task))
    }
    abortController.abort(ERR_ABORT)
    setAbortController(new AbortController)
  }, [abortController])
  return [tasks, setTasks, cancelTasks];
}

export function useUploadEnqueue() {
  const setTransferTasks = useContext(SetTransferQueueContext);
  return (...requests: { basedir: string; file: File }[]) => {
    const newTasks = requests.map(
      ({ basedir, file }) =>
      ({
        id: uuidv4(),
        status: "pending",
        name: file.name,
        file,
        remoteKey: (basedir ? basedir + "/" : "") + file.name,
        loaded: 0,
        total: file.size,
      } as TransferTask)
    );
    setTransferTasks((tasks) => [...tasks, ...newTasks]);
  };
}

export function TransferQueueProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [transferTasks, _setTransferTasks] = useState<TransferTask[]>([]);
  const taskProcessing = useRef<TransferTask | null>(null);
  const tasks = useRef<TransferTask[]>(transferTasks);
  const [abortController, setAbortController] = useState<AbortController>(new AbortController)

  const { effectiveAuth } = useConfig()

  // It's a ugly workaround:
  // In strict mode, React 18+ trigger useEffect twice in dev env:
  // See https://react.dev/learn/synchronizing-with-effects .
  // As the setter of useState is async, it will cause infinitely uploading the same file in dev mode.
  // As a workaround, use ref (which is sync) to store latest tasks info.
  // So setTransferTasks must update both the state and ref.
  // We cann't use only the ref because update to ref's value will NOT re-render.
  // The orthodox solution is to move upload logic out of useEffect.
  const setTransferTasks: React.Dispatch<React.SetStateAction<TransferTask[]>> = function (arg) {
    let newtasks: TransferTask[]
    if (typeof arg == "function") {
      newtasks = arg(tasks.current)
    } else {
      newtasks = arg
    }
    tasks.current = newtasks
    _setTransferTasks(newtasks)
  }

  function currentTaskUpdater(props: Partial<TransferTask>) {
    const currentTask = taskProcessing.current!;
    return (tasks: TransferTask[]) => {
      const newTask: TransferTask = { ...currentTask, ...props };
      const newTasks = tasks.map((t) =>
        t === taskProcessing.current ? newTask : t
      );
      if (currentTask === taskProcessing.current) {
        taskProcessing.current = newTask;
      }
      return newTasks;
    };
  }

  useEffect(() => {
    const taskToProcess = tasks.current.find(task => task.status === "pending");
    if (!taskToProcess || taskProcessing.current) {
      return;
    }
    taskProcessing.current = taskToProcess;
    setTransferTasks(currentTaskUpdater({ status: "in-progress" }));
    processTransferTask({
      auth: effectiveAuth,
      task: taskToProcess,
      signal: abortController.signal,
      onTaskProgress: ({ loaded }) => {
        setTransferTasks(currentTaskUpdater({ loaded }));
      },
    })
      .then(() => {
        setTransferTasks(currentTaskUpdater({ status: "completed" }));
        taskProcessing.current = null;
      })
      .catch((error) => {
        if (error === ERR_ABORT) {
          setTransferTasks(currentTaskUpdater({ status: "canceled" }));
        } else {
          setTransferTasks(currentTaskUpdater({ status: "failed", error }));
        }
        taskProcessing.current = null;
      });
  }, [transferTasks]);

  return (
    <TransferQueueContext.Provider value={transferTasks}>
      <SetTransferQueueContext.Provider value={setTransferTasks}>
        <TransferAbortControllerContext.Provider value={abortController}>
          <SetTransferAbortControllerContext.Provider value={setAbortController}>
            {children}
          </SetTransferAbortControllerContext.Provider>
        </TransferAbortControllerContext.Provider>
      </SetTransferQueueContext.Provider>
    </TransferQueueContext.Provider>
  );
}
