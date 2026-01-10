import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { LogIn, LogOut, User, Cloud, CloudOff } from 'lucide-react';

const UserMenu = () => {
    const { user, isAuthenticated, isLoading, login, logout } = useAuth();

    if (isLoading) {
        return (
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        );
    }

    if (!isAuthenticated) {
        return (
            <Button
                variant="outline"
                size="sm"
                onClick={login}
                className="gap-2"
                data-testid="login-btn"
            >
                <LogIn className="w-4 h-4" />
                Sign in to Sync
            </Button>
        );
    }

    const initials = user?.name
        ?.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="relative h-9 w-9 rounded-full"
                    data-testid="user-menu-trigger"
                >
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={user?.picture} alt={user?.name} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {user?.email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    <Cloud className="w-4 h-4 mr-2 text-primary" />
                    Recordings sync enabled
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={logout}
                    className="text-destructive focus:text-destructive cursor-pointer"
                    data-testid="logout-btn"
                >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

// Sync status indicator for recording panel
export const SyncStatus = () => {
    const { isAuthenticated, user } = useAuth();

    if (!isAuthenticated) {
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CloudOff className="w-3 h-3" />
                <span>Guest mode - recordings local only</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 text-xs text-primary">
            <Cloud className="w-3 h-3" />
            <span>Syncing as {user?.name?.split(' ')[0]}</span>
        </div>
    );
};

export default UserMenu;
