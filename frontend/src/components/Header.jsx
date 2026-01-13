import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeftRight, Plus, MessageCircle, User, LogOut, Package } from "lucide-react";

export const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="glass-header sticky top-0 z-50" data-testid="header">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2" data-testid="logo-link">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
              SwapFlow
            </span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Post Item Button */}
            <Button
              onClick={() => navigate("/post")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-4 shadow-lg hover:shadow-indigo-500/30 transition-all duration-300"
              data-testid="post-item-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Post Item
            </Button>

            {/* Messages */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/messages")}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              data-testid="messages-btn"
            >
              <MessageCircle className="w-5 h-5" />
            </Button>

            {/* Trades */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/trades")}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              data-testid="trades-btn"
            >
              <ArrowLeftRight className="w-5 h-5" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full"
                  data-testid="user-menu-btn"
                >
                  <Avatar className="h-10 w-10 border-2 border-slate-200">
                    <AvatarImage src={user?.picture} alt={user?.name} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-600 font-medium">
                      {getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center gap-3 p-3 border-b">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.picture} alt={user?.name} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-600">
                      {getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                    <p className="text-xs text-slate-500">
                      {user?.trade_points || 0} trade points
                    </p>
                  </div>
                </div>
                <DropdownMenuItem
                  onClick={() => navigate(`/profile/${user?.user_id}`)}
                  className="cursor-pointer"
                  data-testid="profile-menu-item"
                >
                  <User className="w-4 h-4 mr-2" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/my-items")}
                  className="cursor-pointer"
                  data-testid="my-items-menu-item"
                >
                  <Package className="w-4 h-4 mr-2" />
                  My Items
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/trades")}
                  className="cursor-pointer"
                  data-testid="trades-menu-item"
                >
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  My Trades
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                  data-testid="logout-menu-item"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};
