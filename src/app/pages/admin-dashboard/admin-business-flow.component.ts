import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-business-flow',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-business-flow.component.html',
  styleUrls: ['./admin-business-flow.component.scss']
})
export class AdminBusinessFlowComponent {
  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/admin']);
  }
}
