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
import { humanReadableSize } from "../lib/commons";
import { TransferTask, useTransferQueue } from "./app/transferQueue";

export default function ProgressDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tasks, setTasks] = useTransferQueue();

  const hasCompletedTask = !!tasks.find(task => task.status == "completed")
  const hasFailedTask = !!tasks.find(task => task.status == "failed")

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", p: 2 }}>
        <span>Uploads progress</span>
        <span>
          <IconButton disabled={!hasCompletedTask} color="secondary" title="Clear done uploads" onClick={() => {
            setTasks(tasks => tasks.filter(task => task.status != "completed"))
          }}><DeleteIcon /></IconButton>
          <IconButton disabled={!hasFailedTask} color="secondary" title="Re-try failed uploads" onClick={() => {
            setTasks(tasks => tasks.map(task => task.status == "failed" ?
              { ...task, status: "pending" } as TransferTask : task))
          }}><ReplayIcon /></IconButton>
        </span>
      </DialogTitle>
      <DialogContent sx={{ padding: 0 }}>
        <List>
          {tasks.map((task) => (
            <ListItem key={task.name}>
              <ListItemText
                primary={task.name}
                secondary={`${humanReadableSize(
                  task.loaded
                )} / ${humanReadableSize(task.total)}`}
              />
              {task.status === "failed" ? (
                <Tooltip title={task.error.message}>
                  <ErrorOutlineIcon color="error" />
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
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}
