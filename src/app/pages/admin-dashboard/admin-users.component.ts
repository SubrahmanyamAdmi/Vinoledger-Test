import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss', './admin-page-theme.scss']
})
export class AdminUsersComponent implements OnInit {
  users = [
    { id: '1', name: 'Amit Sharma', role: 'ADMIN', email: 'amit.s@vinoledger...', shop: 'Mumbai Central' },
    { id: '2', name: 'Suresh Varma', role: 'OWNER', email: 'suresh.v@marsonho...', shop: 'Marson House' },
    { id: '3', name: 'Priya Singh', role: 'CASHIER', email: 'priya.s@vinoledge...', shop: 'Delhi NCR' },
    { id: '4', name: 'Vikram Rathore', role: 'CASHIER', email: 'vikram.r@vinoledg...', shop: 'Jaipur City' },
    { id: '5', name: 'Neha Gupta', role: 'OWNER', email: 'neha.g@liquorstor...', shop: 'Pune South' },
    { id: '6', name: 'Rahul Mehra', role: 'CASHIER', email: 'rahul.m@vinoledge...', shop: 'Bangalore East' },
    { id: '7', name: 'Anjali Das', role: 'CASHIER', email: 'anjali.d@vinoledg...', shop: 'Chennai Port' },
    { id: '8', name: 'Karan Johar', role: 'ADMIN', email: 'karan.j@vinoledge...', shop: 'Indore Main' },
    { id: '9', name: 'Meena Iyer', role: 'CASHIER', email: 'meena.i@vinoledge...', shop: 'Kolkata Hub' }
  ];

  totalUsers = this.users.length;

  constructor(private router: Router, public auth: AuthService) {}

  ngOnInit() {}

  addNewUser() {
    alert('Add New User functionality to be implemented');
  }

  deleteUser(userId: string) {
    if (confirm('Are you sure you want to delete this user?')) {
      this.users = this.users.filter(u => u.id !== userId);
      this.totalUsers = this.users.length;
      alert('User deleted successfully');
    }
  }

  goBack() {
    this.router.navigate(['/admin']);
  }
}
