from locust import HttpUser, task, between


class MerendaUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        response = self.client.post("/api/auth/token/", json={
            "email": "admin@semed.local",
            "password": "Admin123!",
        })
        self.token = response.json().get("access")

    @task(3)
    def list_schools(self):
        self.client.get("/api/schools/", headers={"Authorization": f"Bearer {self.token}"})

    @task(3)
    def list_stock(self):
        self.client.get("/api/stock/", headers={"Authorization": f"Bearer {self.token}"})

    @task(2)
    def list_menus(self):
        self.client.get("/api/menus/", headers={"Authorization": f"Bearer {self.token}"})

    @task(1)
    def dashboard(self):
        self.client.get("/api/dashboard/", headers={"Authorization": f"Bearer {self.token}"})
