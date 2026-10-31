/* Finite kernel task-pressure probe; threads sleep until joined, no fork bomb. */
#include <pthread.h>
#include <errno.h>
#include <stdio.h>
#include <stdatomic.h>
#include <time.h>
static atomic_int release_threads = 0;
static void *wait_thread(void *unused) {
  (void)unused;
  struct timespec pause = {0, 10000000};
  while (!atomic_load(&release_threads)) nanosleep(&pause, NULL);
  return NULL;
}
int main(void) {
  pthread_t threads[160];
  pthread_attr_t attr;
  if (pthread_attr_init(&attr) || pthread_attr_setstacksize(&attr, 65536)) return 2;
  int created = 0, error = 0;
  for (; created < 160; created++) {
    error = pthread_create(&threads[created], &attr, wait_thread, NULL);
    if (error) break;
  }
  atomic_store(&release_threads, 1);
  for (int i = 0; i < created; i++) pthread_join(threads[i], NULL);
  pthread_attr_destroy(&attr);
  printf("{\"requested\":160,\"created\":%d,\"capacityDenied\":%s}\n", created, error == EAGAIN ? "true" : "false");
  return error == EAGAIN ? 23 : error ? 2 : 0;
}
