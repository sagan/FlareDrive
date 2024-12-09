import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { processTransferTask } from "./transfer";

export interface TransferTask {
  type: "upload" | "download";
  status: "pending" | "in-progress" | "completed" | "failed";
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

export function useTransferQueue() {
  return useContext(TransferQueueContext);
}

export function useUploadEnqueue() {
  const setTransferTasks = useContext(SetTransferQueueContext);
  return (...requests: { basedir: string; file: File }[]) => {
    const newTasks = requests.map(
      ({ basedir, file }) =>
      ({
        type: "upload",
        status: "pending",
        name: file.name,
        file,
        remoteKey: basedir + file.name,
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

  // It's a ugly workaround:
  // If using strict mode, React 18+ trigger useEffect twice in dev env:
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
    const taskToProcess = tasks.current.find(
      (task) => task.status === "pending"
    );
    if (!taskToProcess || taskProcessing.current) {
      return;
    }
    taskProcessing.current = taskToProcess;
    setTransferTasks(currentTaskUpdater({ status: "in-progress" }));
    processTransferTask({
      task: taskToProcess,
      onTaskProgress: ({ loaded }) => {
        setTransferTasks(currentTaskUpdater({ loaded }));
      },
    })
      .then(() => {
        setTransferTasks(currentTaskUpdater({ status: "completed" }));
        taskProcessing.current = null;
      })
      .catch((error) => {
        setTransferTasks(currentTaskUpdater({ status: "failed", error }));
      });
  }, [transferTasks]);

  return (
    <TransferQueueContext.Provider value={transferTasks}>
      <SetTransferQueueContext.Provider value={setTransferTasks}>
        {children}
      </SetTransferQueueContext.Provider>
    </TransferQueueContext.Provider>
  );
}
