import React, { useState } from "react";
import { OrderForm } from "./OrderForm";
import { OrderList } from "./OrderList";
import { Order } from "../types";

export const OrdersView: React.FC = () => {
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  return (
    <div className="space-y-6 pb-24 md:pb-0 animate-fade-in">
      <OrderForm 
        orderToEdit={editingOrder} 
        onFinish={() => setEditingOrder(null)} 
      />
      <OrderList 
        onEditOrder={setEditingOrder} 
      />
    </div>
  );
};
