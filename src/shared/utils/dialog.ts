import Swal from 'sweetalert2'

export async function confirmDialog(
  title: string,
  text: string = '',
  confirmText: string = 'Confirm'
): Promise<boolean> {
  const isDark = document.documentElement.classList.contains('dark')

  const result = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancel',
    background: isDark ? '#181715' : '#faf9f5', // matches dark.DEFAULT or canvas.DEFAULT
    color: isDark ? '#faf9f5' : '#141413', // matches on-dark or ink
    confirmButtonColor: '#cc785c', // matches primary
    cancelButtonColor: isDark ? '#252320' : '#efe9de', // matches dark.elevated or canvas.card
    customClass: {
      popup: 'rounded-xl border border-hairline dark:border-gray-800 shadow-xl font-sans',
      title: 'text-lg font-serif font-normal text-ink dark:text-gray-100',
      htmlContainer: 'text-sm font-sans text-ink-body dark:text-gray-300',
      confirmButton: 'rounded-md px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-offset-2 focus:ring-primary text-white',
      cancelButton: 'rounded-md px-4 py-2 text-sm font-medium border border-hairline dark:border-gray-800 focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 text-ink-body dark:text-gray-300'
    },
    buttonsStyling: true
  })

  return result.isConfirmed
}

export async function promptDialog(
  title: string,
  placeholder: string = '',
  defaultValue: string = ''
): Promise<string | null> {
  const isDark = document.documentElement.classList.contains('dark')

  const result = await Swal.fire({
    title,
    input: 'text',
    inputValue: defaultValue,
    inputPlaceholder: placeholder,
    showCancelButton: true,
    confirmButtonText: 'Submit',
    cancelButtonText: 'Cancel',
    background: isDark ? '#181715' : '#faf9f5',
    color: isDark ? '#faf9f5' : '#141413',
    confirmButtonColor: '#cc785c',
    cancelButtonColor: isDark ? '#252320' : '#efe9de',
    customClass: {
      popup: 'rounded-xl border border-hairline dark:border-gray-800 shadow-xl font-sans',
      title: 'text-lg font-serif font-normal text-ink dark:text-gray-100',
      input: 'rounded-md border border-hairline bg-canvas/50 px-3 py-2 outline-none focus:border-primary dark:border-gray-800 dark:bg-dark-elevated text-sm font-sans text-ink dark:text-gray-100',
      confirmButton: 'rounded-md px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-offset-2 focus:ring-primary text-white',
      cancelButton: 'rounded-md px-4 py-2 text-sm font-medium border border-hairline dark:border-gray-800 focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 text-ink-body dark:text-gray-300'
    },
    buttonsStyling: true
  })

  return result.isConfirmed ? result.value : null
}
