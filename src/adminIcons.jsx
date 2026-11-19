import { base, COMMON } from "./icons.jsx";
import { Warehouse, LayoutDashboard, LineChart, Settings, PenLine, IndianRupee, Receipt, Wheat, Syringe, ShoppingBasket, HardHat, ListChecks, FolderOpen, Home, Bell, KeyRound, HardDriveDownload, UserCog, Inbox, Users, Truck, FileText, CheckCircle2, CalendarDays, CalendarRange, Wallet, TrendingUp, Boxes, Store, UserRound } from "lucide-react";

/* icons for the owner dashboard */
export const Ia = base({ ...COMMON, farm: Warehouse, overview: LayoutDashboard, chart: LineChart, settings: Settings, today: PenLine, money: IndianRupee, receipt: Receipt, stock: Boxes, feed: Wheat, wheat: Wheat, health: Syringe, cart: ShoppingBasket,
  staff: HardHat, tasks: ListChecks, docs: FolderOpen, home: Home, bell: Bell, key: KeyRound, backup: HardDriveDownload, account: UserCog, inbox: Inbox, users: Users, suppliers: Truck, fields: FileText, ok: CheckCircle2, day: CalendarDays, month: CalendarRange,
  wallet: Wallet, trend: TrendingUp, shop: Store, owner: UserRound });
