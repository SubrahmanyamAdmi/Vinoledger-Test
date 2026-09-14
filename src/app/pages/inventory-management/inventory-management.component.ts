import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TopbarComponent } from '../../shared/topbar/topbar.component';
import { SidenavComponent } from '../../shared/sidenav/sidenav.component';
import { BusinessDataService } from '../../services/business-data.service';

@Component({
  selector: 'app-inventory-management',
  standalone: true,
  imports: [CommonModule, MatToolbarModule, TopbarComponent, SidenavComponent],
  templateUrl: './inventory-management.component.html',
  styleUrls: ['./inventory-management.component.scss']
})
export class InventoryManagementComponent implements OnInit {
  inventory: any[] = [];
  constructor(private data: BusinessDataService) {}
  ngOnInit(): void {
    this.data.getInventory().subscribe((items) => (this.inventory = items));
  }
}
