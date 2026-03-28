import { Bell, Search, Menu } from "lucide-react";
import * as Avatar from "@radix-ui/react-avatar";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Link } from "wouter";

export function Header() {
  return (
    <header className="h-16 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <button className="md:hidden p-2 text-muted-foreground hover:bg-secondary rounded-lg transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <div className="relative hidden sm:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search transactions, reports..." 
            className="w-64 pl-9 pr-4 py-2 bg-secondary/50 border border-transparent focus:border-border focus:bg-background rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-primary/10"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-muted-foreground hover:bg-secondary rounded-full transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-background"></span>
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="outline-none">
            <Avatar.Root className="w-9 h-9 rounded-full overflow-hidden border-2 border-background shadow-sm hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer">
              <Avatar.Image 
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop" 
                className="w-full h-full object-cover"
                alt="User Avatar"
              />
              <Avatar.Fallback className="w-full h-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                JS
              </Avatar.Fallback>
            </Avatar.Root>
          </DropdownMenu.Trigger>
          
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="min-w-[200px] bg-popover rounded-xl shadow-xl border border-popover-border p-2 animate-in fade-in slide-in-from-top-2 z-50 mr-4 mt-2">
              <div className="px-3 py-2 border-b border-border mb-2">
                <p className="font-semibold text-sm">Jane Smith</p>
                <p className="text-xs text-muted-foreground">jane@acmecorp.com</p>
              </div>
              <DropdownMenu.Item className="px-3 py-2 text-sm rounded-lg cursor-pointer outline-none hover:bg-secondary hover:text-secondary-foreground transition-colors">
                <Link href="/settings">Profile Settings</Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="px-3 py-2 text-sm rounded-lg cursor-pointer outline-none hover:bg-secondary hover:text-secondary-foreground transition-colors">
                Billing
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-border my-2" />
              <DropdownMenu.Item className="px-3 py-2 text-sm text-destructive rounded-lg cursor-pointer outline-none hover:bg-destructive/10 transition-colors">
                <Link href="/login">Log out</Link>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
