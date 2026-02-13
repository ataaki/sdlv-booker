import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { Fragment } from 'react'
import Button from './Button'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  confirmVariant?: 'primary' | 'danger' | 'success'
  loading?: boolean
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  confirmVariant = 'primary',
  loading,
}: ConfirmDialogProps) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-[10000]">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-5 max-sm:items-end max-sm:p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-250"
            enterFrom="opacity-0 scale-95 max-sm:translate-y-full"
            enterTo="opacity-100 scale-100 max-sm:translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100 max-sm:translate-y-0"
            leaveTo="opacity-0 scale-95 max-sm:translate-y-full"
          >
            <DialogPanel className="w-full max-w-md bg-white rounded-2xl max-sm:rounded-b-none p-7 shadow-xl">
              <DialogTitle className="text-lg font-bold text-slate-900">{title}</DialogTitle>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">{message}</p>
              <div className="flex justify-end gap-2.5 mt-6 max-sm:flex-col-reverse">
                <Button variant="secondary" onClick={onClose}>
                  Annuler
                </Button>
                <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
                  {confirmLabel}
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
