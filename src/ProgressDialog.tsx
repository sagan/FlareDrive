import {
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Tooltip,
} from "@mui/material";
import React from "react";
import {
  CheckCircleOutline as CheckCircleOutlineIcon,
  ErrorOutline as ErrorOutlineIcon,
} from "@mui/icons-material";
import ReplayIcon from '@mui/icons-material/Replay';
import DeleteIcon from '@mui/icons-material/Delete';
import CancelIcon from '@mui/icons-material/Cancel';
import { humanReadableSize } from "../lib/commons";
import { TransferTask, useTransferQueue } from "./app/transferQueue";

export default function ProgressDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tasks, setTasks, cancelTasks] = useTransferQueue();

  const hasDoneTask = !!tasks.find(task => task.status == "completed" || task.status == "canceled")
  const hasFailedTask = !!tasks.find(task => task.status == "failed" || task.status == "canceled")
  const hasIncomingTask = !!tasks.find(task => task.status == "in-progress" || task.status == "pending")

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", p: 2 }}>
        <span>Uploads progress</span>
        <span>
          <IconButton disabled={!hasDoneTask} color="secondary" title="Delete done uploads" onClick={() => {
            setTasks(tasks => tasks.filter(t => t.status != "completed" && t.status != "canceled"))
          }}><DeleteIcon /></IconButton>
          <IconButton disabled={!hasFailedTask} color="secondary" title="Re-try failed uploads" onClick={() => {
            setTasks(tasks => tasks.map(task => task.status == "failed" || task.status == "canceled" ?
              { ...task, status: "pending" } as TransferTask : task))
          }}><ReplayIcon /></IconButton>
          <IconButton disabled={!hasIncomingTask} color="secondary" title="Cancel all uploads"
            onClick={() => cancelTasks(true)}>
            <CancelIcon />
          </IconButton>
        </span>
      </DialogTitle>
      <DialogContent sx={{ padding: 0 }}>
        <List>
          {tasks.map((task) => (
            <ListItem key={task.id} >
              <ListItemText
                primary={task.name}
                secondary={`${humanReadableSize(
                  task.loaded
                )} / ${humanReadableSize(task.total)}`}
              />
              {task.status === "failed" ? (
                <Tooltip title={`${task.error}`}>
                  <ErrorOutlineIcon color="error" />
                </Tooltip>
              ) : task.status === "canceled" ? (
                <Tooltip title="Task canceled">
                  <ErrorOutlineIcon color="info" />
                </Tooltip>
              ) : task.status === "completed" ? (
                <CheckCircleOutlineIcon color="success" />
              ) : task.status === "in-progress" ? (
                <CircularProgress
                  variant="determinate"
                  size={24}
                  value={(task.loaded / task.total) * 100}
                />
              ) : null}
              {(task.status == "failed" || task.status == "canceled") && <IconButton title="Re-try upload"
                onClick={e => {
                  setTasks(tasks => {
                    const newTasks: TransferTask[] = []
                    tasks.forEach(t => {
                      if (t.id != task.id || (t.status != "failed" && t.status != "canceled")) {
                        newTasks.push(t)
                      } else {
                        newTasks.push({ ...t, status: "pending" })
                      }
                    })
                    return newTasks
                  })
                }}>
                <ReplayIcon />
              </IconButton>}
              <IconButton title={task.status == "in-progress" ? "Cancel" : "Delete"} onClick={e => {
                if (task.status == "in-progress") {
                  cancelTasks()
                }
                setTasks(tasks => {
                  const newTasks: TransferTask[] = []
                  tasks.forEach(t => {
                    if (t.id != task.id) {
                      newTasks.push(t)
                    } else if (t.status == "in-progress") {
                      newTasks.push({ ...t, status: "canceled" })
                    } // else : remote task from list
                  })
                  return newTasks
                })
              }}>
                {task.status == "in-progress" ? <CancelIcon /> : <DeleteIcon />}
              </IconButton>
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}
