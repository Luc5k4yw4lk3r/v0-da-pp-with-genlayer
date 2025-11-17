"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AboutProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function AboutProjectModal({ open, onOpenChange }: AboutProjectModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-primary">
            About This Project
          </DialogTitle>
          <DialogDescription className="sr-only">
            Information about the Proof of Steak project
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>Proof of Steak</strong> is a <strong>decentralized application (dApp)</strong> that invites users to <strong>upload photos</strong> showcasing <strong>authentic Argentine cultural experiences</strong> — with a <strong>special highlight</strong> on the <strong>iconic steak and asado tradition</strong> — and evaluates how <strong>"Argentinean"</strong> each submission appears using <strong>GenLayer's decentralized AI consensus</strong> (<strong>scoring 0–100</strong>).
          </p>
          <p>
            Photos are <strong>ranked</strong> on <strong>public leaderboards</strong> across themed <strong>tracks</strong> such as <strong>food</strong>, <strong>customs</strong>, <strong>sports</strong>, <strong>touristic spots</strong>, <strong>crypto & community</strong>, among others. The platform operates in a <strong>transparent</strong> and <strong>trustless</strong> manner, leveraging <strong>GenLayer's consensus</strong> as a <strong>"digital court"</strong> where <strong>validator nodes</strong> powered by <strong>diverse AI models</strong> collectively decide on <strong>subjective cultural scoring</strong> — reducing <strong>bias</strong> and enabling <strong>fair</strong>, <strong>crowdsourced-style cultural evaluation</strong>.
          </p>
          <p>
            To celebrate <strong>Argentina's steak heritage</strong>, the <strong>top-ranked steak photo</strong> will <strong>win an invitation to an asado for two people</strong>.
          </p>
          <p>
            We are <strong>actively seeking sponsors</strong> for <strong>categories</strong>, <strong>rewards</strong>, and <strong>special tracks</strong>.<br />
            For <strong>collaboration</strong>, <strong>questions</strong>, or <strong>partnership proposals</strong>, contact: <strong>Twitter/X: @luck_loce</strong>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
